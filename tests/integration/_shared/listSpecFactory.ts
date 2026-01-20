import { expect, type APIRequestContext } from '@playwright/test';
import { assertHasFields, makeListApi, toSelectQuery } from './spHttp';

export type ListSpec<TCreate extends Record<string, unknown>> = {
  name: string;
  siteUrl: string;      // absolute site url e.g. https://xxx.sharepoint.com/sites/yyy
  listTitle: string;    // e.g. Staff_Master
  keyField: string;     // e.g. StaffID / UserID
  selectFields: string[]; // fields you require (schema)
  fixedKeyValue: string; // stable key to avoid record growth
  makeUpsertPayload: (key: string) => TCreate; // create/update payload
  // optional: "deactivate" or "resolve" semantics
  afterUpsertAssert?: (item: any) => void;
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

type ODataItem = { d?: any; value?: any };

function buildListItemUrl(siteUrl: string, listTitle: string): string {
  // SharePoint REST endpoint
  return `${siteUrl}/_api/web/lists/GetByTitle('${encodeURIComponent(listTitle)}')/items`;
}

function buildItemByIdUrl(siteUrl: string, listTitle: string, id: number): string {
  return `${buildListItemUrl(siteUrl, listTitle)}(${id})`;
}

export function createListRunner<TCreate extends Record<string, unknown>>(
  request: APIRequestContext,
  spec: ListSpec<TCreate>,
): ListRunner {
  const api = makeListApi({ request, baseUrl: '', listTitle: spec.listTitle });

  const itemsUrl = buildListItemUrl(spec.siteUrl, spec.listTitle);

  const select = toSelectQuery(['Id', spec.keyField, ...spec.selectFields]);
  const filter = `${spec.keyField} eq '${spec.fixedKeyValue.replace(/'/g, "''")}'`; // OData escape

  async function fetchByKey(): Promise<any[]> {
    const url = `${itemsUrl}?$select=${select}&$filter=${encodeURIComponent(filter)}&$top=5`;
    const res = await api.get(url, `${spec.name}:listByKey`);
    const json: ODataItem = await res.json().catch(() => ({}));
    const rows = json?.d?.results ?? json?.value ?? [];
    return rows;
  }

  async function upsertOnce(): Promise<{ id: number; count: number; item: any }> {
    const before = await fetchByKey();
    if (before.length > 0) {
      const id = Number(before[0].Id);
      const url = buildItemByIdUrl(spec.siteUrl, spec.listTitle, id);
      await api.merge(url, spec.makeUpsertPayload(spec.fixedKeyValue), `${spec.name}:merge`);
      const after = await fetchByKey();
      return { id, count: after.length, item: after[0] };
    }

    // Create (POST)
    const url = itemsUrl;
    await api.post(url, spec.makeUpsertPayload(spec.fixedKeyValue), `${spec.name}:create`);
    const after = await fetchByKey();
    expect(after.length).toBeGreaterThan(0);
    return { id: Number(after[0].Id), count: after.length, item: after[0] };
  }

  return {
    async reachability() {
      const url = `${itemsUrl}?$select=Id&$top=1`;
      const res = await api.get(url, `${spec.name}:reachability`);
      await res.json().catch(() => ({}));
    },

    async schema() {
      const rows = await fetchByKey();
      // If not found yet, create once so schema can be asserted on a real item
      const item = rows[0] ?? (await upsertOnce()).item;
      assertHasFields(item, ['Id', spec.keyField, ...spec.selectFields]);
    },

    async idempotentUpsert() {
      const first = await upsertOnce();
      const second = await upsertOnce();

      // Idempotent requirement: count should not grow for fixed key
      expect(second.count).toBe(first.count);

      if (spec.afterUpsertAssert) {
        spec.afterUpsertAssert(second.item);
      }
    },

    async deactivateIfNeeded() {
      if (!spec.deactivate) return;

      const rows = await fetchByKey();
      const item = rows[0] ?? (await upsertOnce()).item;
      const id = Number(item.Id);

      const url = buildItemByIdUrl(spec.siteUrl, spec.listTitle, id);
      await api.merge(url, { [spec.deactivate.field]: spec.deactivate.value }, `${spec.name}:deactivate`);

      const after = await fetchByKey();
      expect(after.length).toBeGreaterThan(0);
      expect(after[0][spec.deactivate.field]).toEqual(spec.deactivate.value);
    },
  };
}
