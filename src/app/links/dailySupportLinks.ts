// ---------------------------------------------------------------------------
// dailySupportLinks — /daily/support への URL 契約
//
// URL パラメータ仕様（TimeBasedSupportRecordPage 準拠）:
//   userId (or user) : string   — 利用者ID
//   step             : string   — getScheduleKey(time, activity) 形式
//   unfilled         : '1'      — 未記入のみモード
//   date             : YYYY-MM-DD — 対象日（省略時=今日）
// ---------------------------------------------------------------------------

export interface DailySupportLinkParams {
  userId?: string;
  date?: string;       // YYYY-MM-DD
  unfilled?: boolean;
  step?: string;
}

/**
 * /daily/support への URL を生成する。
 * URL 契約をコードで固定し、将来の仕様変更にも追随しやすくする。
 */
export function buildDailySupportUrl(params?: DailySupportLinkParams): string {
  const base = '/daily/support';
  if (!params) return base;

  const search = new URLSearchParams();

  if (params.userId) {
    search.set('userId', params.userId);
  }
  if (params.date) {
    search.set('date', params.date);
  }
  if (params.unfilled) {
    search.set('unfilled', '1');
  }
  if (params.step) {
    search.set('step', params.step);
  }

  const qs = search.toString();
  return qs ? `${base}?${qs}` : base;
}

/**
 * 未記入モードで /daily/support を開く URL を生成。
 * IBDハブの「モニタリング」セクションから使用。
 */
export function buildUnfilledSupportUrl(userId?: string, date?: string): string {
  return buildDailySupportUrl({ userId, date, unfilled: true });
}
