import { expect, type APIRequestContext } from '@playwright/test';
import { assertHasFields, makeListApi, toSelectQuery, type SpClient } from './spHttp';
import { mapSchemaPayload, resolveSchemaFields } from '../../../scripts/ci/resolve-schema-fields.mjs';
import * as fs from 'fs';
import * as path from 'path';

export type ListSpec<TCreate extends Record<string, unknown>> = {
  name: string;
  siteUrl: string;      // absolute site url e.g. https://xxx.sharepoint.com/sites/yyy
  listTitle: string;    // e.g. Staff_Master
  keyField: string;     // e.g. StaffID / UserID
  selectFields: string[]; // fields you require (schema)
  fieldAliases?: Record<string, readonly string[]>; // logical -> physical InternalName aliases
  fixedKeyValue: string; // stable key to avoid record growth
  makeUpsertPayload: (key: string) => TCreate; // create/update payload
  // optional: "deactivate" or "resolve" semantics
  afterUpsertAssert?: (item: any, logicalToPhysical?: Record<string, string>) => void;
  deactivate?: {
    field: string;       // e.g. IsActive / Status
    value: unknown;      // e.g. false / 'Resolved'
  };
};

export type ListRunner = {
  reachability: () => Promise<void>;
  schema: () => Promise<void>;
  idempotentUpsert: () => Promise<void>;
  deactivateIfNeeded: () => Promise<void>;
};

export type ResolvedListFields = {
  logicalToPhysical: Record<string, string>;
  keyField: string;
  selectFields: string[];
  deactivateField?: string;
};

type ODataItem = { d?: any; value?: any };

function buildListItemUrl(siteUrl: string, listTitle: string): string {
  // SharePoint REST endpoint
  return `${siteUrl}/_api/web/lists/GetByTitle('${encodeURIComponent(listTitle)}')/items`;
}

function buildItemByIdUrl(siteUrl: string, listTitle: string, id: number): string {
  return `${buildListItemUrl(siteUrl, listTitle)}(${id})`;
}

export function resolveListSpecFields<TCreate extends Record<string, unknown>>(
  spec: ListSpec<TCreate>,
  actualNames: string[],
): ResolvedListFields {
  const logicalNames = [
    spec.keyField,
    ...spec.selectFields,
    ...(spec.deactivate ? [spec.deactivate.field] : []),
  ];

  if (!spec.fieldAliases) {
    const logicalToPhysical = Object.fromEntries(
      [...new Set(logicalNames)].map((name) => [name, name]),
    );
    return {
      logicalToPhysical,
      keyField: spec.keyField,
      selectFields: spec.selectFields,
      deactivateField: spec.deactivate?.field,
    };
  }

  const result = resolveSchemaFields(actualNames, logicalNames, spec.fieldAliases);
  if (result.missing.length || result.ambiguous.length) {
    const missing = result.missing.join(', ') || '(none)';
    const ambiguous = result.ambiguous
      .map(({ logical, actual }) => `${logical} -> ${actual.join(', ')}`)
      .join('; ') || '(none)';
    throw new Error(
      `[integration] ${spec.name}: unresolved SharePoint fields\n` +
      `missing=${missing}\n` +
      `ambiguous=${ambiguous}`,
    );
  }

  return {
    logicalToPhysical: result.resolved,
    keyField: result.resolved[spec.keyField],
    selectFields: spec.selectFields.map((field) => result.resolved[field]),
    deactivateField: spec.deactivate
      ? result.resolved[spec.deactivate.field]
      : undefined,
  };
}

export function createListRunner<TCreate extends Record<string, unknown>>(
  request: APIRequestContext,
  spec: ListSpec<TCreate>,
): ListRunner {
  // Extract auth headers from storageState (Fallback for raw APIRequestContext)
  const authHeaders: Record<string, string> = {};
  const storageStatePath = path.resolve(process.cwd(), 'tests/.auth/storageState.json');

  if (fs.existsSync(storageStatePath)) {
    try {
      const storageState = JSON.parse(fs.readFileSync(storageStatePath, 'utf-8'));
      const cookies = storageState.cookies || [];
      const cookieString = cookies
        .map((c: any) => `${c.name}=${c.value}`)
        .join('; ');

      if (cookieString) {
        authHeaders['Cookie'] = cookieString;
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[integration] Failed to load auth from storageState:', e);
    }
  }

  const client: SpClient = {
    baseUrl: spec.siteUrl,
    request,
    listTitle: spec.listTitle,
    authHeaders,
  };
  const api = makeListApi(client);

  const itemsUrl = buildListItemUrl(spec.siteUrl, spec.listTitle);

  let resolvedFieldsPromise: Promise<ResolvedListFields> | undefined;

  async function resolveFields(): Promise<ResolvedListFields> {
    if (!spec.fieldAliases) {
      return resolveListSpecFields(spec, []);
    }

    const fieldsUrl =
      `${spec.siteUrl}/_api/web/lists/GetByTitle('${encodeURIComponent(spec.listTitle)}')/fields?` +
      '$filter=Hidden eq false&$select=InternalName';
    const response = await api.get(fieldsUrl, `${spec.name}:discoverFields`);
    const json = await response.json().catch(() => ({}));
    const fields = json?.d?.results ?? json?.value ?? [];
    const actualNames = fields
      .map((field: { InternalName?: unknown }) => field.InternalName)
      .filter((name: unknown): name is string => typeof name === 'string');
    return resolveListSpecFields(spec, actualNames);
  }

  function getResolvedFields(): Promise<ResolvedListFields> {
    resolvedFieldsPromise ??= resolveFields();
    return resolvedFieldsPromise;
  }

  async function fetchByKey(): Promise<any[]> {
    const fields = await getResolvedFields();
    const select = toSelectQuery(['Id', fields.keyField, ...fields.selectFields]);
    const filter = `${fields.keyField} eq '${spec.fixedKeyValue.replace(/'/g, "''")}'`; // OData escape
    const url = `${itemsUrl}?$select=${select}&$filter=${encodeURIComponent(filter)}&$top=5`;
    const res = await api.get(url, `${spec.name}:listByKey`);
    const json: ODataItem = await res.json().catch(() => ({}));
    const rows = json?.d?.results ?? json?.value ?? [];
    return rows;
  }

  async function upsertOnce(): Promise<{ id: number; count: number; item: any }> {
    const fields = await getResolvedFields();
    const makePayload = () => mapSchemaPayload(
      spec.makeUpsertPayload(spec.fixedKeyValue),
      fields.logicalToPhysical,
    );
    const before = await fetchByKey();
    if (before.length > 0) {
      const id = Number(before[0].Id);
      const url = buildItemByIdUrl(spec.siteUrl, spec.listTitle, id);
      await api.merge(url, makePayload(), `${spec.name}:merge`);
      const after = await fetchByKey();
      return { id, count: after.length, item: after[0] };
    }

    // Create (POST)
    const url = itemsUrl;
    await api.post(url, makePayload(), `${spec.name}:create`);
    const after = await fetchByKey();
    expect(after.length).toBeGreaterThan(0);
    return { id: Number(after[0].Id), count: after.length, item: after[0] };
  }

  return {
    async reachability() {
      await getResolvedFields();
      const url = `${itemsUrl}?$select=Id&$top=1`;
      const res = await api.get(url, `${spec.name}:reachability`);
      await res.json().catch(() => ({}));
    },

    async schema() {
      const fields = await getResolvedFields();
      const rows = await fetchByKey();
      // If not found yet, create once so schema can be asserted on a real item
      const item = rows[0] ?? (await upsertOnce()).item;
      assertHasFields(item, ['Id', fields.keyField, ...fields.selectFields]);
    },

    async idempotentUpsert() {
      const first = await upsertOnce();
      const second = await upsertOnce();

      // Idempotent requirement: count should not grow for fixed key
      expect(second.count).toBe(first.count);

      if (spec.afterUpsertAssert) {
        const fields = await getResolvedFields();
        spec.afterUpsertAssert(second.item, fields.logicalToPhysical);
      }
    },

    async deactivateIfNeeded() {
      if (!spec.deactivate) return;

      const fields = await getResolvedFields();
      const rows = await fetchByKey();
      const item = rows[0] ?? (await upsertOnce()).item;
      const id = Number(item.Id);

      const url = buildItemByIdUrl(spec.siteUrl, spec.listTitle, id);
      const payload = mapSchemaPayload(
        { [spec.deactivate.field]: spec.deactivate.value },
        fields.logicalToPhysical,
      );
      await api.merge(url, payload, `${spec.name}:deactivate`);

      const after = await fetchByKey();
      expect(after.length).toBeGreaterThan(0);
      expect(after[0][fields.deactivateField || spec.deactivate.field]).toEqual(spec.deactivate.value);
    },
  };
}
