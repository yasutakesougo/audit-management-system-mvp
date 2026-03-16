/**
 * 祝日・休業日管理
 *
 * 現在は静的テーブル（2025〜2026年度）で提供。
 * 将来的に SharePoint リスト (Holiday_Master) からの動的読み込みに移行予定。
 *
 * @see src/sharepoint/fields/holidayFields.ts — SP リストのフィールド定義
 */

// ── 2025年度 ──
const HOLIDAYS_2025: Record<string, string> = {
  '2025-01-01': '元日',
  '2025-01-13': '成人の日',
  '2025-02-11': '建国記念の日',
  '2025-02-23': '天皇誕生日',
  '2025-02-24': '振替休日',
  '2025-03-20': '春分の日',
  '2025-04-29': '昭和の日',
  '2025-05-03': '憲法記念日',
  '2025-05-04': 'みどりの日',
  '2025-05-05': 'こどもの日',
  '2025-05-06': '振替休日',
  '2025-07-21': '海の日',
  '2025-08-11': '山の日',
  '2025-09-15': '敬老の日',
  '2025-09-23': '秋分の日',
  '2025-10-13': 'スポーツの日',
  '2025-11-03': '文化の日',
  '2025-11-23': '勤労感謝の日',
  '2025-11-24': '振替休日',
};

// ── 2026年度 ──
const HOLIDAYS_2026: Record<string, string> = {
  '2026-01-01': '元日',
  '2026-01-12': '成人の日',
  '2026-02-11': '建国記念の日',
  '2026-02-23': '天皇誕生日',
  '2026-03-20': '春分の日',
  '2026-04-29': '昭和の日',
  '2026-05-03': '憲法記念日',
  '2026-05-04': 'みどりの日',
  '2026-05-05': 'こどもの日',
  '2026-05-06': '振替休日',
  '2026-07-20': '海の日',
  '2026-08-11': '山の日',
  '2026-09-21': '敬老の日',
  '2026-09-23': '秋分の日',
  '2026-10-12': 'スポーツの日',
  '2026-11-03': '文化の日',
  '2026-11-23': '勤労感謝の日',
};

/** 静的テーブル（後方互換 export） */
export const HOLIDAYS: Record<string, string> = {
  ...HOLIDAYS_2025,
  ...HOLIDAYS_2026,
};

// ── 動的キャッシュ（SP リスト読み込み後に上書き） ──
let dynamicHolidays: Record<string, string> | null = null;

/**
 * 指定日が祝日かどうかを判定し、祝日名を返す。
 * 動的データ（SP リスト由来）がある場合はそちらを優先。
 */
export const getHolidayLabel = (isoDate: string): string | undefined =>
  (dynamicHolidays ?? HOLIDAYS)[isoDate];

/**
 * SP リスト (Holiday_Master) から取得した祝日データでキャッシュを更新する。
 *
 * @example
 * const rows = await spClient.listItems<HolidayRow>('Holiday_Master', { ... });
 * const map: Record<string, string> = {};
 * rows.forEach(r => { map[r.Date] = r.Label; });
 * setDynamicHolidays(map);
 */
export function setDynamicHolidays(holidays: Record<string, string>): void {
  dynamicHolidays = holidays;
}

/** テスト用: 動的キャッシュをクリア */
export function resetDynamicHolidays(): void {
  dynamicHolidays = null;
}
