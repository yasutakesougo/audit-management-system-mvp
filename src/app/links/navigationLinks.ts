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

// ─── Handoff Timeline Navigation ───────────────────────────────────────

import type { HandoffTimelineNavState } from '@/features/cross-module/navigationState';
import type { TodayScene } from '@/features/today/domain/todayScene';

/**
 * 場面から申し送りの時間帯フィルタを推定する。
 *
 * 午前帯の場面 → 'morning' フィルタ
 * 午後帯の場面 → 'evening' フィルタ
 * それ以外 → undefined (全件表示)
 */
export function sceneToTimeBand(scene: TodayScene): 'morning' | 'evening' | undefined {
  const morningScenes: TodayScene[] = [
    'morning-briefing',
    'arrival-intake',
    'before-am-activity',
    'am-activity',
  ];
  const eveningScenes: TodayScene[] = [
    'post-activity',
    'before-departure',
    'day-closing',
  ];

  if (morningScenes.includes(scene)) return 'morning';
  if (eveningScenes.includes(scene)) return 'evening';
  return undefined;
}

/**
 * /today → /handoff-timeline への意味付きナビゲーション state を生成。
 *
 * 使い方:
 *   navigate('/handoff-timeline', {
 *     state: buildHandoffFromTodayState({ timeFilter: sceneToTimeBand(scene) }),
 *   });
 */
export function buildHandoffFromTodayState(opts?: {
  timeFilter?: 'morning' | 'evening';
  focusUserId?: string;
}): HandoffTimelineNavState {
  return {
    dayScope: 'today',
    timeFilter: opts?.timeFilter ?? 'all',
    focusUserId: opts?.focusUserId,
    from: 'today',
  };
}

