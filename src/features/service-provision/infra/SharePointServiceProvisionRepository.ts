/**
 * SharePoint ServiceProvisionRecords Repository
 *
 * サービス提供実績の SharePoint CRUD。
 * attendanceDailyRepository.ts と同じ EntryKey ベースの upsert パターン。
 */
import { createSpClient, ensureConfig } from '@/lib/spClient';
import {
  SERVICE_PROVISION_FIELDS,
  SERVICE_PROVISION_LIST_TITLE,
  SERVICE_PROVISION_SELECT_FIELDS,
} from '@/sharepoint/fields';

import type { ServiceProvisionRepository } from '../domain/ServiceProvisionRepository';
import type {
  ProvisionSource,
  ServiceProvisionRecord,
  ServiceProvisionStatus,
  UpsertProvisionInput,
} from '../domain/types';
import { makeEntryKey } from '../domain/types';

// ─── 日付変換 ────────────────────────────────────────────────
// B層: "YYYY-MM-DD" ⇄ SP DateOnly: "YYYY-MM-DDT00:00:00Z"

const toSpDateOnlyValue = (recordDateISO: string): string =>
  `${recordDateISO}T00:00:00Z`;

const fromSpDateOnlyValue = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value.slice(0, 10); // "YYYY-MM-DD"
};

// ─── OData ───────────────────────────────────────────────────

const escapeODataString = (value: string): string =>
  value.replace(/'/g, "''");

// ─── 型安全ヘルパー ──────────────────────────────────────────

type SharePointRow = Record<string, unknown> & { Id?: number };

const getString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const getNumber = (value: unknown): number | undefined =>
  typeof value === 'number' ? value : undefined;

const getBool = (value: unknown): boolean => Boolean(value);

// ─── SP → ドメイン変換 ──────────────────────────────────────

const toRecord = (row: SharePointRow): ServiceProvisionRecord | null => {
  const entryKey = getString(row[SERVICE_PROVISION_FIELDS.entryKey]);
  const userCode = getString(row[SERVICE_PROVISION_FIELDS.userCode]);
  const recordDateRaw = row[SERVICE_PROVISION_FIELDS.recordDate];
  const status = getString(row[SERVICE_PROVISION_FIELDS.status]);

  if (!entryKey || !userCode || !status) return null;

  return {
    id: typeof row.Id === 'number' ? row.Id : -1,
    entryKey,
    userCode,
    recordDateISO: fromSpDateOnlyValue(recordDateRaw),
    status: status as ServiceProvisionStatus,

    startHHMM: getNumber(row[SERVICE_PROVISION_FIELDS.startHHMM]) ?? null,
    endHHMM: getNumber(row[SERVICE_PROVISION_FIELDS.endHHMM]) ?? null,

    hasTransport: getBool(row[SERVICE_PROVISION_FIELDS.hasTransport]),
    hasTransportPickup: getBool(row[SERVICE_PROVISION_FIELDS.hasTransportPickup]),
    hasTransportDropoff: getBool(row[SERVICE_PROVISION_FIELDS.hasTransportDropoff]),
    hasMeal: getBool(row[SERVICE_PROVISION_FIELDS.hasMeal]),
    hasBath: getBool(row[SERVICE_PROVISION_FIELDS.hasBath]),
    hasExtended: getBool(row[SERVICE_PROVISION_FIELDS.hasExtended]),
    hasAbsentSupport: getBool(row[SERVICE_PROVISION_FIELDS.hasAbsentSupport]),

    note: getString(row[SERVICE_PROVISION_FIELDS.note]) ?? '',
    source: (getString(row[SERVICE_PROVISION_FIELDS.source]) as ProvisionSource) ?? undefined,
    updatedByUPN: getString(row[SERVICE_PROVISION_FIELDS.updatedByUPN]) ?? '',
  };
};

// ─── ドメイン → SP 変換 ──────────────────────────────────────

const omitUndefined = (
  record: Record<string, unknown>,
): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  );

const toSpPayload = (
  entryKey: string,
  input: UpsertProvisionInput,
): Record<string, unknown> =>
  omitUndefined({
    [SERVICE_PROVISION_FIELDS.entryKey]: entryKey,
    [SERVICE_PROVISION_FIELDS.userCode]: input.userCode,
    [SERVICE_PROVISION_FIELDS.recordDate]: toSpDateOnlyValue(
      input.recordDateISO,
    ),
    [SERVICE_PROVISION_FIELDS.status]: input.status,
    [SERVICE_PROVISION_FIELDS.startHHMM]: input.startHHMM,
    [SERVICE_PROVISION_FIELDS.endHHMM]: input.endHHMM,
    [SERVICE_PROVISION_FIELDS.hasTransport]: input.hasTransport ?? (input.hasTransportPickup || input.hasTransportDropoff),
    [SERVICE_PROVISION_FIELDS.hasTransportPickup]: input.hasTransportPickup,
    [SERVICE_PROVISION_FIELDS.hasTransportDropoff]: input.hasTransportDropoff,
    [SERVICE_PROVISION_FIELDS.hasMeal]: input.hasMeal,
    [SERVICE_PROVISION_FIELDS.hasBath]: input.hasBath,
    [SERVICE_PROVISION_FIELDS.hasExtended]: input.hasExtended,
    [SERVICE_PROVISION_FIELDS.hasAbsentSupport]: input.hasAbsentSupport,
    [SERVICE_PROVISION_FIELDS.note]: input.note,
    [SERVICE_PROVISION_FIELDS.source]: input.source ?? 'Unified',
    [SERVICE_PROVISION_FIELDS.updatedByUPN]: input.updatedByUPN,
  });

// ─── Repository 関数 ─────────────────────────────────────────

/**
 * EntryKey で1件取得
 */
export async function getByEntryKey(
  client: ReturnType<typeof createSpClient>,
  entryKey: string,
  listTitle: string = SERVICE_PROVISION_LIST_TITLE,
): Promise<ServiceProvisionRecord | null> {
  const select = [...SERVICE_PROVISION_SELECT_FIELDS];
  const filter = `${SERVICE_PROVISION_FIELDS.entryKey} eq '${escapeODataString(entryKey)}'`;

  const rows = await client.getListItemsByTitle<SharePointRow>(
    listTitle,
    select,
    filter,
    undefined,
    1,
  );

  const first = rows?.[0];
  return first ? toRecord(first) : null;
}

/**
 * 指定日の全レコード取得
 */
export async function listByDate(
  client: ReturnType<typeof createSpClient>,
  recordDateISO: string,
  listTitle: string = SERVICE_PROVISION_LIST_TITLE,
): Promise<ServiceProvisionRecord[]> {
  const select = [...SERVICE_PROVISION_SELECT_FIELDS];
  const filter = `${SERVICE_PROVISION_FIELDS.recordDate} eq '${escapeODataString(recordDateISO)}'`;

  const rows = await client.getListItemsByTitle<SharePointRow>(
    listTitle,
    select,
    filter,
  );

  return (rows ?? [])
    .map(toRecord)
    .filter((item): item is ServiceProvisionRecord => item !== null);
}

/**
 * 指定月の全レコード取得（OData日付範囲フィルタ）
 */
export async function listByMonth(
  client: ReturnType<typeof createSpClient>,
  monthISO: string,
  listTitle: string = SERVICE_PROVISION_LIST_TITLE,
): Promise<ServiceProvisionRecord[]> {
  // monthISO = "2026-02" → start=2026-02-01, end=2026-03-01
  const [year, month] = monthISO.split('-').map(Number);
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

  const select = [...SERVICE_PROVISION_SELECT_FIELDS];
  const filter = `${SERVICE_PROVISION_FIELDS.recordDate} ge '${startDate}' and ${SERVICE_PROVISION_FIELDS.recordDate} lt '${endDate}'`;

  const rows = await client.getListItemsByTitle<SharePointRow>(
    listTitle,
    select,
    filter,
  );

  return (rows ?? [])
    .map(toRecord)
    .filter((item): item is ServiceProvisionRecord => item !== null);
}

/**
 * EntryKey で Upsert（更新または作成）
 *
 * 1. EntryKey で検索（top=1）
 * 2. 存在すれば PATCH（ETag付き）
 * 3. 存在しなければ POST
 */
export async function upsertByEntryKey(
  client: ReturnType<typeof createSpClient>,
  input: UpsertProvisionInput,
  listTitle: string = SERVICE_PROVISION_LIST_TITLE,
): Promise<ServiceProvisionRecord> {
  const entryKey = makeEntryKey(input.userCode, input.recordDateISO);
  const select = [...SERVICE_PROVISION_SELECT_FIELDS];
  const filter = `${SERVICE_PROVISION_FIELDS.entryKey} eq '${escapeODataString(entryKey)}'`;

  // 1) GET by EntryKey (top 1)
  const existing = await client.getListItemsByTitle<SharePointRow>(
    listTitle,
    select,
    filter,
    undefined,
    1,
  );

  const payload = toSpPayload(entryKey, input);

  // 2) 存在すれば PATCH by Id
  if (existing && existing.length > 0 && typeof existing[0].Id === 'number') {
    const existingId = existing[0].Id;
    const { etag } = await client.getItemByIdWithEtag(
      listTitle,
      existingId,
      select,
    );
    await client.updateItemByTitle(listTitle, existingId, payload, {
      ifMatch: etag ?? '*',
    });
    // 更新後のレコードを返す
    const updated = toRecord({ ...existing[0], ...payload, Id: existingId });
    return updated ?? {
      id: existingId,
      entryKey,
      userCode: input.userCode,
      recordDateISO: input.recordDateISO,
      status: input.status,
    };
  }

  // 3) 存在しなければ POST
  const created = await client.addListItemByTitle<Record<string, unknown>, SharePointRow>(
    listTitle,
    payload,
  );
  const record = toRecord(created);
  return record ?? {
    id: typeof created?.Id === 'number' ? created.Id : -1,
    entryKey,
    userCode: input.userCode,
    recordDateISO: input.recordDateISO,
    status: input.status,
  };
}

// ─── ファクトリヘルパー ──────────────────────────────────────

/**
 * 認証付き SharePoint Repository を生成
 */
export function createSharePointServiceProvisionRepository(
  acquireToken: () => Promise<string | null>,
): ServiceProvisionRepository {
  const client = createSpClient(acquireToken, ensureConfig().baseUrl);

  return {
    getByEntryKey: (entryKey: string) =>
      getByEntryKey(client, entryKey),
    listByDate: (recordDateISO: string) =>
      listByDate(client, recordDateISO),
    listByMonth: (monthISO: string) =>
      listByMonth(client, monthISO),
    upsertByEntryKey: (input: UpsertProvisionInput) =>
      upsertByEntryKey(client, input),
  };
}
