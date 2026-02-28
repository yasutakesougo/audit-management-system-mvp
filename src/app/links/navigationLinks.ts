// ---------------------------------------------------------------------------
// navigationLinks — Hub 間遷移用の URL ビルダー
//
// /today (Ops Hub) ⇄ /dailysupport (Records Hub) の双方向導線で使う。
// query を手書きで散らさず、このモジュール経由で URL を組み立てる。
//
// ⚠️ Hub間遷移（/today ⇄ /dailysupport）でのみ使用。
//    通常のページ遷移は dailyPaths（dailyLinks.ts）を使うこと。
//
// パターンは dailySupportLinks.ts と同一。
// ---------------------------------------------------------------------------

import { dailyPaths } from './dailyLinks';

// ─── Query Key 定数 ────────────────────────────────────────────────────
export const NAV_QUERY = {
  from: 'from',
  date: 'date',
} as const;

/** 許可された遷移元。union を拡張するには allowedFrom にも追加すること。 */
export type NavFrom = 'today';

const allowedFrom = new Set<NavFrom>(['today']);

// ─── Builders ──────────────────────────────────────────────────────────

/**
 * /dailysupport?from=today&date=YYYY-MM-DD を生成する。
 * /today → /dailysupport への導線で使用。
 */
export function buildDailyHubFromTodayUrl(date?: string): string {
  const base = dailyPaths.hub;
  const search = new URLSearchParams();
  search.set(NAV_QUERY.from, 'today');

  const trimmed = date?.trim();
  if (trimmed) {
    search.set(NAV_QUERY.date, trimmed);
  }

  return `${base}?${search.toString()}`;
}

/**
 * /today?date=YYYY-MM-DD を生成する。
 * /dailysupport → /today への戻り導線で使用。
 */
export function buildTodayReturnUrl(date?: string): string {
  const base = '/today';
  const trimmed = date?.trim();
  if (!trimmed) return base;

  const search = new URLSearchParams();
  search.set(NAV_QUERY.date, trimmed);
  return `${base}?${search.toString()}`;
}

// ─── Parser ────────────────────────────────────────────────────────────

/**
 * URLSearchParams から from / date を安全にパースする。
 * 許可リスト外の from は undefined として扱う。
 */
export function parseNavQuery(params: URLSearchParams): {
  from: NavFrom | undefined;
  date: string | undefined;
} {
  const rawFrom = params.get(NAV_QUERY.from);
  const from = rawFrom && allowedFrom.has(rawFrom as NavFrom)
    ? (rawFrom as NavFrom)
    : undefined;

  const rawDate = params.get(NAV_QUERY.date)?.trim();
  const date = rawDate || undefined;

  return { from, date };
}
