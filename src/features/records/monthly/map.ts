// SharePoint連携用のデータ変換とUpsert処理
// Power AutomateとTypeScriptで共通利用

import type { MonthlyRecordKey, MonthlySummary, YearMonth } from './types';

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
 */
export function toSharePointFields(summary: MonthlySummary) {
  return {
    UserCode: summary.userId,
    YearMonth: summary.yearMonth,
    DisplayName: summary.displayName,
    LastUpdated: summary.lastUpdatedUtc,
    KPI_TotalDays: summary.kpi.totalDays,
    KPI_PlannedRows: summary.kpi.plannedRows,
    KPI_CompletedRows: summary.kpi.completedRows,
    KPI_InProgressRows: summary.kpi.inProgressRows,
    KPI_EmptyRows: summary.kpi.emptyRows,
    KPI_SpecialNotes: summary.kpi.specialNotes,
    KPI_Incidents: summary.kpi.incidents,
    CompletionRate: summary.completionRate,
    FirstEntryDate: summary.firstEntryDate || undefined,
    LastEntryDate: summary.lastEntryDate || undefined,
    IdempotencyKey: `${summary.userId}#${summary.yearMonth}`,
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
 * SharePointフィールドからMonthlySummaryに変換
 */
export function fromSharePointFields(fields: SharePointMonthlyItem): MonthlySummary {
  return {
    userId: fields.UserCode,
    yearMonth: fields.YearMonth as YearMonth,
    displayName: fields.DisplayName,
    lastUpdatedUtc: fields.LastUpdated,
    kpi: {
      totalDays: fields.KPI_TotalDays || 0,
      plannedRows: fields.KPI_PlannedRows || 0,
      completedRows: fields.KPI_CompletedRows || 0,
      inProgressRows: fields.KPI_InProgressRows || 0,
      emptyRows: fields.KPI_EmptyRows || 0,
      specialNotes: fields.KPI_SpecialNotes || 0,
      incidents: fields.KPI_Incidents || 0,
    },
    completionRate: fields.CompletionRate || 0,
    firstEntryDate: fields.FirstEntryDate || undefined,
    lastEntryDate: fields.LastEntryDate || undefined,
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
export function buildMonthlyRecordFilter(options: {
  yearMonth?: YearMonth;
  userId?: string;
  userIds?: string[];
  minCompletionRate?: number;
}): string {
  const filters: string[] = [];

  if (options.yearMonth) {
    filters.push(`YearMonth eq '${options.yearMonth}'`);
  }

  if (options.userId) {
    filters.push(`UserCode eq '${options.userId}'`);
  }

  if (options.userIds && options.userIds.length > 0) {
    const userFilter = options.userIds
      .map(id => `UserCode eq '${id}'`)
      .join(' or ');
    filters.push(`(${userFilter})`);
  }

  if (typeof options.minCompletionRate === 'number') {
    filters.push(`CompletionRate ge ${options.minCompletionRate}`);
  }

  return filters.length > 0 ? filters.join(' and ') : '';
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
  const filters: string[] = [];

  // 日付範囲
  filters.push(`(RecordDate ge datetime'${startISO}')`);
  filters.push(`(RecordDate lt datetime'${endISO}')`);

  // ユーザー指定
  if (options.userId) {
    filters.push(`(UserLookup/UserCode eq '${options.userId}')`);
  }

  if (options.userIds && options.userIds.length > 0) {
    const userFilter = options.userIds
      .map(id => `UserLookup/UserCode eq '${id}'`)
      .join(' or ');
    filters.push(`(${userFilter})`);
  }

  return filters.join(' and ');
}

/**
 * Upsert用のSharePoint操作インターフェース
 * 実装は各環境（Power Automate / TypeScript + Graph API）で対応
 */
export interface SharePointClient {
  findByIdempotencyKey(listName: string, key: string): Promise<SharePointMonthlyItem | null>;
  create(listName: string, fields: Partial<SharePointMonthlyItem>): Promise<SharePointMonthlyItem>;
  update(listName: string, itemId: number, fields: Partial<SharePointMonthlyItem>): Promise<SharePointMonthlyItem>;
}

/**
 * 月次サマリーのUpsert処理（冪等性保証）
 */
export async function upsertMonthlySummary(
  client: SharePointClient,
  summary: MonthlySummary
): Promise<{ action: 'created' | 'updated' | 'skipped'; itemId?: number }> {
  const fields = toSharePointFields(summary);
  const key = fields.IdempotencyKey;

  try {
    // 既存レコード検索
    const existing = await client.findByIdempotencyKey('MonthlyRecord_Summary', key);

    if (existing) {
      // 更新が必要かチェック（簡易版：LastUpdated比較）
      const existingDate = new Date(existing.LastUpdated);
      const newDate = new Date(summary.lastUpdatedUtc);

      if (newDate > existingDate && existing.Id != null) {
        const result = await client.update('MonthlyRecord_Summary', existing.Id, fields);
        return { action: 'updated', itemId: result.Id };
      } else {
        return { action: 'skipped', itemId: existing.Id };
      }
    } else {
      // 新規作成
      const result = await client.create('MonthlyRecord_Summary', fields);
      return { action: 'created', itemId: result.Id };
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