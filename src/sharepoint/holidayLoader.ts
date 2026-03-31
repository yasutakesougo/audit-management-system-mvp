/**
 * Holiday_Master SP リストローダー
 *
 * SharePoint の Holiday_Master リストから祝日データを読み込み、
 * holidays.ts の動的キャッシュに反映する。
 *
 * アプリ起動時に1回呼び出す想定。
 * SP リストが存在しない / 読み込みエラー時は静的フォールバックに自動退避。
 */
import type { UseSP } from '@/lib/spClient';
import {
  HOLIDAY_MASTER_FIELDS,
  HOLIDAY_MASTER_LIST_TITLE,
  HOLIDAY_MASTER_SELECT_FIELDS,
} from '@/sharepoint/fields/holidayFields';
import { setDynamicHolidays } from '@/sharepoint/holidays';
import { buildEq, joinAnd } from '@/sharepoint/query/builders';

/** SP リストから返される行の型 */
export interface SpHolidayRow {
  Id: number;
  Title: string;
  Date: string;           // ISO date string
  Label: string;
  Type?: string | null;
  FiscalYear?: string | null;
  IsActive?: boolean | null;
}

/**
 * Holiday_Master リストから祝日を読み込み、動的キャッシュに設定する。
 *
 * @param sp - SP クライアント (useSP() の戻り値)
 * @param options.fiscalYear - 年度で絞り込む場合 (例: '2026')
 * @param options.activeOnly - 有効なもののみ読み込む (デフォルト: true)
 * @returns 読み込んだ祝日件数
 *
 * @example
 * ```ts
 * const sp = useSP();
 * useEffect(() => {
 *   loadHolidaysFromSharePoint(sp).catch(console.warn);
 * }, [sp]);
 * ```
 */
export async function loadHolidaysFromSharePoint(
  sp: UseSP,
  options: {
    fiscalYear?: string;
    activeOnly?: boolean;
  } = {},
): Promise<number> {
  const { fiscalYear, activeOnly = true } = options;

  try {
    // OData フィルター構築
    const filters: string[] = [];
    if (activeOnly) {
      filters.push(buildEq(HOLIDAY_MASTER_FIELDS.isActive, true));
    }
    if (fiscalYear) {
      filters.push(buildEq(HOLIDAY_MASTER_FIELDS.fiscalYear, fiscalYear));
    }

    const filter = joinAnd(filters) || undefined;

    const rows = await sp.listItems<SpHolidayRow>(HOLIDAY_MASTER_LIST_TITLE, {
      select: [...HOLIDAY_MASTER_SELECT_FIELDS] as string[],
      filter,
      top: 500, // 年間最大でも100件程度なので余裕
    });

    if (!rows || rows.length === 0) {
      console.info('[HolidayLoader] Holiday_Master から0件取得 — 静的フォールバックを使用');
      return 0;
    }

    // SP 行 → Record<isoDate, label> に変換
    const holidayMap: Record<string, string> = {};
    for (const row of rows) {
      const dateStr = normalizeDate(row.Date);
      if (dateStr) {
        holidayMap[dateStr] = row.Label || row.Title;
      }
    }

    setDynamicHolidays(holidayMap);
    console.info(`[HolidayLoader] ✅ ${Object.keys(holidayMap).length} 件の祝日を SP リストから読み込みました`);

    return Object.keys(holidayMap).length;
  } catch (error) {
    // SP リスト未作成やネットワークエラー時は静的フォールバックに退避
    console.warn('[HolidayLoader] Holiday_Master の読み込みに失敗 — 静的フォールバックを使用:', error);
    return 0;
  }
}

/**
 * SP の日付値を ISO 日付文字列 (YYYY-MM-DD) に正規化する。
 * SP は日付を ISO 8601 形式 (e.g. '2026-01-01T00:00:00Z') で返すため、
 * 日付部分のみを取り出す。
 */
function normalizeDate(rawDate: string | null | undefined): string | null {
  if (!rawDate) return null;

  // ISO 8601: 2026-01-01T00:00:00Z → 2026-01-01
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(rawDate);
  return match ? match[1] : null;
}

/** @internal テスト用 */
export const __test__ = { normalizeDate };
