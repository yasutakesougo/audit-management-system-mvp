// SharePoint連携用のデータ変換とUpsert処理
// Power AutomateとTypeScriptで共通利用

import type { IsoDate, MonthlyRecordKey, MonthlySummary, MonthlySummaryId, YearMonth } from './types';
import {
  buildDateTime,
  buildEq,
  buildGe,
  buildLt,
  joinAnd,
  joinOr,
} from '@/sharepoint/query/builders';

import { BILLING_SUMMARY_CANDIDATES } from '@/sharepoint/fields/billingFields';
import { resolveInternalNamesDetailed } from '@/lib/sp/helpers';

/** Guard for dynamic field resolution with fallback */
function asField(physical: string | undefined, fallback: string): string {
  // Graceful fallback to provided default if mapping is missing
  return physical || fallback;
}

function getResolvedCandidates(key: keyof typeof BILLING_SUMMARY_CANDIDATES): readonly string[] {
  return BILLING_SUMMARY_CANDIDATES[key];
}

function uniqueCandidates(...candidates: Array<string | undefined>): string[] {
  return [...new Set(candidates.filter((candidate): candidate is string => Boolean(candidate)))];
}

async function findExistingMonthlySummary(
  client: SharePointClient,
  listName: string,
  key: string,
  primaryFieldName: string
): Promise<Record<string, unknown> | null> {
  for (const fieldName of uniqueCandidates(primaryFieldName, ...getResolvedCandidates('idempotencyKey'))) {
    const existing = await client.findByIdempotencyKey(listName, fieldName, key);
    if (existing) {
      if (fieldName !== primaryFieldName) {
        console.warn('[monthly-summary:legacy-idempotency-fallback-used]', {
          primaryFieldName,
          fallbackFieldName: fieldName,
        });
      }
      return existing;
    }
  }

  return null;
}

/** DailyRecord リストのフィールド定義 (OData フィルタ SSOT) */
const DAILY_RECORD_FILTER_FIELDS = {
  recordDate: 'RecordDate',
  userLookupCode: 'UserLookup/UserCode',
} as const;

/**
 * 文字列が YearMonth 形式（YYYY-MM, 月01〜12）かを検証
 */
export function parseYearMonth(value: unknown): YearMonth | null {
  if (typeof value !== 'string') return null;
  
  // YYYY-MM 形式チェック（月は01〜12）
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) return null;
  
  return value as YearMonth;
}

/**
 * YearMonth を文字列にフォーマット（検証済みなのでそのまま返す）
 */
export function formatYearMonth(yearMonth: YearMonth): string {
  return yearMonth;
}

/**
 * 文字列が IsoDate 形式（YYYY-MM-DD）かを検証
 */
export function parseIsoDate(value: unknown): IsoDate | null {
  if (typeof value !== 'string') return null;
  
  // YYYY-MM-DD 形式チェック（月01〜12、日01〜31の簡易チェック）
  const match = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.exec(value);
  if (!match) return null;
  
  return value as IsoDate;
}

/**
 * MonthlySummaryId を生成（userId__yearMonth）
 */
export function generateMonthlySummaryId(userId: string, yearMonth: YearMonth): MonthlySummaryId {
  return `${userId}__${yearMonth}` as MonthlySummaryId;
}

/**
 * 日付から YearMonth 形式に変換（UTC基準）
 */
export function toYearMonth(date: Date): YearMonth {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}` as YearMonth;
}

/**
 * 現在月のYearMonthを取得
 */
export function getCurrentYearMonth(): YearMonth {
  return toYearMonth(new Date());
}

/**
 * YearMonthから月の範囲（開始・終了）を取得
 */
export function getMonthRange(yearMonth: YearMonth): {
  startDate: Date;
  endDate: Date;
  startISO: string;
  endISO: string;
} {
  const [year, month] = yearMonth.split('-').map(Number);

  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1); // 次月の1日（終了は排他的）

  return {
    startDate,
    endDate,
    startISO: startDate.toISOString(),
    endISO: endDate.toISOString(),
  };
}

/**
 * MonthlySummaryをSharePointフィールド形式に変換
 * mapping が提供されている場合は動的な列名を使用する
 */
export function toSharePointFields(
  summary: MonthlySummary,
  mapping?: Record<string, string | undefined>
) {
  const get = (key: string, fallback: string) => asField(mapping?.[key], fallback);

  return {
    [get('userId', 'UserCode')]: summary.userId,
    [get('yearMonth', 'YearMonth')]: summary.yearMonth,
    [get('displayName', 'DisplayName')]: summary.displayName,
    [get('lastUpdated', 'LastUpdated')]: summary.lastUpdatedUtc,
    [get('totalDays', 'KPI_TotalDays')]: summary.kpi.totalDays,
    [get('plannedRows', 'KPI_PlannedRows')]: summary.kpi.plannedRows,
    [get('completedRows', 'KPI_CompletedRows')]: summary.kpi.completedRows,
    [get('inProgressRows', 'KPI_InProgressRows')]: summary.kpi.inProgressRows,
    [get('emptyRows', 'KPI_EmptyRows')]: summary.kpi.emptyRows,
    [get('specialNotes', 'KPI_SpecialNotes')]: summary.kpi.specialNotes,
    [get('incidents', 'KPI_Incidents')]: summary.kpi.incidents,
    [get('completionRate', 'CompletionRate')]: summary.completionRate,
    [get('firstEntryDate', 'FirstEntryDate')]: summary.firstEntryDate || undefined,
    [get('lastEntryDate', 'LastEntryDate')]: summary.lastEntryDate || undefined,
    [get('idempotencyKey', 'IdempotencyKey')]: `${summary.userId}#${summary.yearMonth}`,
  };
}

// SharePoint アイテムの型定義
export interface SharePointMonthlyItem {
  Id?: number;
  UserCode: string;
  YearMonth: string;
  DisplayName: string;
  LastUpdated: string;
  KPI_TotalDays?: number;
  KPI_PlannedRows?: number;
  KPI_CompletedRows?: number;
  KPI_InProgressRows?: number;
  KPI_EmptyRows?: number;
  KPI_SpecialNotes?: number;
  KPI_Incidents?: number;
  CompletionRate?: number;
  FirstEntryDate?: string;
  LastEntryDate?: string;
  IdempotencyKey: string;
}

/**
 * SharePointフィールドからMonthlySummaryに変換（型検証付き）
 */
export function fromSharePointFields(
  fields: Record<string, unknown>,
  mapping?: Record<string, string | undefined>
): MonthlySummary {
  const get = (key: string, fallback: string) => fields[asField(mapping?.[key], fallback)];
  const str = (val: unknown) => (val != null ? String(val) : '');
  const num = (val: unknown) => (val != null ? Number(val) : 0);

  // YearMonth 検証
  const ymValue = str(get('yearMonth', 'YearMonth'));
  const yearMonth = parseYearMonth(ymValue);
  if (!yearMonth) {
    throw new Error(`Invalid YearMonth format: ${ymValue}`);
  }

  // IsoDate 検証
  const fed = str(get('firstEntryDate', 'FirstEntryDate'));
  const led = str(get('lastEntryDate', 'LastEntryDate'));
  const firstEntryDate = fed ? parseIsoDate(fed) ?? undefined : undefined;
  const lastEntryDate = led ? parseIsoDate(led) ?? undefined : undefined;

  return {
    userId: str(get('userId', 'UserCode')),
    yearMonth,
    displayName: str(get('displayName', 'DisplayName')),
    lastUpdatedUtc: str(get('lastUpdated', 'LastUpdated')),
    kpi: {
      totalDays: num(get('totalDays', 'KPI_TotalDays')),
      plannedRows: num(get('plannedRows', 'KPI_PlannedRows')),
      completedRows: num(get('completedRows', 'KPI_CompletedRows')),
      inProgressRows: num(get('inProgressRows', 'KPI_InProgressRows')),
      emptyRows: num(get('emptyRows', 'KPI_EmptyRows')),
      specialNotes: num(get('specialNotes', 'KPI_SpecialNotes')),
      incidents: num(get('incidents', 'KPI_Incidents')),
    },
    completionRate: num(get('completionRate', 'CompletionRate')),
    firstEntryDate,
    lastEntryDate,
  };
}

/**
 * 冪等性キーを生成
 */
export function generateIdempotencyKey(key: MonthlyRecordKey): string {
  return `${key.userId}#${key.yearMonth}`;
}

/**
 * ODataフィルター文字列を生成（月次データ取得用）
 */
export function buildMonthlyRecordFilter(
  options: {
    yearMonth?: YearMonth;
    userId?: string;
    userIds?: string[];
    minCompletionRate?: number;
  },
  mapping?: Record<string, string | undefined>
): string {
  const filters: (string | undefined)[] = [];
  const f = (key: string, fallback: string) => asField(mapping?.[key], fallback);

  if (options.yearMonth) {
    filters.push(buildEq(f('yearMonth', 'YearMonth'), options.yearMonth));
  }

  if (options.userId) {
    filters.push(buildEq(f('userId', 'UserCode'), options.userId));
  }

  if (options.userIds && options.userIds.length > 0) {
    const userFilters = options.userIds.map(id =>
      buildEq(f('userId', 'UserCode'), id)
    );
    filters.push(`(${joinOr(userFilters)})`);
  }

  if (typeof options.minCompletionRate === 'number') {
    filters.push(buildGe(f('completionRate', 'CompletionRate'), options.minCompletionRate));
  }

  return joinAnd(filters);
}

/**
 * 日次記録取得用のODataフィルター（月範囲）
 */
export function buildDailyRecordFilter(options: {
  yearMonth: YearMonth;
  userId?: string;
  userIds?: string[];
}): string {
  const { startISO, endISO } = getMonthRange(options.yearMonth);
  const filters: (string | undefined)[] = [];

  // 日付範囲
  filters.push(buildGe(DAILY_RECORD_FILTER_FIELDS.recordDate, buildDateTime(startISO)));
  filters.push(buildLt(DAILY_RECORD_FILTER_FIELDS.recordDate, buildDateTime(endISO)));

  // ユーザー指定
  if (options.userId) {
    filters.push(buildEq(DAILY_RECORD_FILTER_FIELDS.userLookupCode, options.userId));
  }

  if (options.userIds && options.userIds.length > 0) {
    const userFilters = options.userIds.map(id =>
      buildEq(DAILY_RECORD_FILTER_FIELDS.userLookupCode, id)
    );
    filters.push(`(${joinOr(userFilters)})`);
  }

  return joinAnd(filters);
}

/**
 * Upsert用のSharePoint操作インターフェース
 */
export interface SharePointClient {
  getListFieldInternalNames(listName: string): Promise<Set<string>>;
  findByIdempotencyKey(listName: string, keyFieldName: string, key: string): Promise<Record<string, unknown> | null>;
  create(listName: string, fields: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(listName: string, itemId: number, fields: Record<string, unknown>): Promise<Record<string, unknown>>;
}

/**
 * 月次サマリーのUpsert処理（冪等性保証 + ドリフト耐性）
 */
export async function upsertMonthlySummary(
  client: SharePointClient,
  summary: MonthlySummary
): Promise<{ action: 'created' | 'updated' | 'skipped'; itemId?: number }> {
  const listName = 'MonthlyRecord_Summary';
  
  // 動的列名解決
  const availableFields = await client.getListFieldInternalNames(listName);
  const { resolved } = resolveInternalNamesDetailed(
    availableFields,
    BILLING_SUMMARY_CANDIDATES as unknown as Record<string, string[]>
  );
  const mapping = resolved as Record<string, string | undefined>;

  const fields = toSharePointFields(summary, mapping);
  const idempotencyFieldName = asField(mapping.idempotencyKey, 'IdempotencyKey');
  const lastUpdatedFieldName = asField(mapping.lastUpdated, 'LastUpdated');
  const key = `${summary.userId}#${summary.yearMonth}`;

  try {
    // 既存レコード検索: canonical first, then intentional legacy fallback (`Key`).
    const existing = await findExistingMonthlySummary(client, listName, key, idempotencyFieldName);

    if (existing) {
      // 更新が必要かチェック
      const existingDateValue = existing[lastUpdatedFieldName];
      const existingDate = new Date(typeof existingDateValue === 'string' || typeof existingDateValue === 'number' ? existingDateValue : 0);
      const newDate = new Date(summary.lastUpdatedUtc);

      if (newDate > existingDate && existing.Id != null) {
        const result = await client.update(listName, Number(existing.Id), fields);
        return { action: 'updated', itemId: result.Id as number | undefined };
      } else {
        return { action: 'skipped', itemId: existing.Id as number | undefined };
      }
    } else {
      // 新規作成
      const result = await client.create(listName, fields);
      return { action: 'created', itemId: result.Id as number | undefined };
    }
  } catch (error) {
    console.error('Upsert failed:', error);
    throw error;
  }
}

/**
 * 複数月次サマリーの一括Upsert
 */
export async function bulkUpsertMonthlySummaries(
  client: SharePointClient,
  summaries: MonthlySummary[]
): Promise<{
  created: number;
  updated: number;
  skipped: number;
  errors: Array<{ summary: MonthlySummary; error: string }>;
}> {
  let created = 0;
  let updated = 0;
  let skipped = 0;
  const errors: Array<{ summary: MonthlySummary; error: string }> = [];

  for (const summary of summaries) {
    try {
      const result = await upsertMonthlySummary(client, summary);
      if (result.action === 'created') created++;
      else if (result.action === 'updated') updated++;
      else skipped++;
    } catch (error) {
      errors.push({
        summary,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { created, updated, skipped, errors };
}
