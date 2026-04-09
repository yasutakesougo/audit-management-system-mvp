// ---------------------------------------------------------------------------
// navigationLinks — Hub 間過渡用の URL ビルダー
//
// /today (Ops Hub) → /daily/activity (Records) の主導線で使う。
// query を手書きで散らさず、このモジュール経由で URL を組み立てる。
//
// ⚠️ Hub間過渡（/today → /daily/activity）でのみ使用。
//    管理・例外導線は /dailysupport（DailyRecordMenuPage）を使うこと。
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
 * /daily/activity?from=today&date=YYYY-MM-DD を生成する。
 * /today → /daily/activity への主導線で使用。
 *
 * → Hero 付きの記録画面に直接入る。
 *   管理・例外導線は dailyPaths.hub (/dailysupport) を使う。
 */
export function buildDailyHubFromTodayUrl(date?: string): string {
  const base = dailyPaths.activity;
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

// ─── Date helpers (inline to avoid circular dependency) ─────────────────
function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayDateStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * /handoff-timeline?range=day&date=YYYY-MM-DD の URL を生成する。
 *
 * P0 日付ナビゲーション対応: 遷移元はこの関数で URL を組み立て、
 * navigate(url, { state }) で呼ぶ。state は互換用 fallback。
 *
 * @example
 *   // 今日
 *   navigate(buildHandoffTimelineUrl());
 *   // 昨日
 *   navigate(buildHandoffTimelineUrl({ date: 'yesterday' }));
 *   // 任意日
 *   navigate(buildHandoffTimelineUrl({ date: '2026-03-09' }));
 */
export function buildHandoffTimelineUrl(opts?: {
  date?: string;
  range?: 'day' | 'week' | 'month';
}): string {
  const range = opts?.range ?? 'day';
  let date: string;

  if (!opts?.date || opts.date === 'today') {
    date = todayDateStr();
  } else if (opts.date === 'yesterday') {
    date = yesterdayDateStr();
  } else {
    date = opts.date;
  }

  const search = new URLSearchParams();
  search.set('range', range);
  search.set('date', date);
  return `/handoff-timeline?${search.toString()}`;
}

/**
 * /today → /handoff-timeline への意味付きナビゲーション state を生成。
 *
 * @deprecated URL ベースの buildHandoffTimelineUrl を優先してください。
 * state は互換用 fallback として残しています。
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

// ─── opsStep → Navigation Target ──────────────────────────────────────

/**
 * opsStep（業務フローステップ）→ ナビゲーション先の情報。
 * NextActionCard で「どこへ行く」ボタンを表示するために使用。
 */
export type OpsNavTarget = {
  /** ナビゲーション先の URL パス */
  href: string;
  /** ボタンラベル（例: 「出欠入力へ」） */
  label: string;
  /** ボタンアイコン種別 */
  icon: 'attendance' | 'record' | 'health' | 'schedule';
};

const OPS_STEP_NAV: Record<string, OpsNavTarget> = {
  intake:       { href: dailyPaths.attendance,   label: '出欠入力へ',     icon: 'attendance' },
  temperature:  { href: dailyPaths.health,       label: 'バイタル記録へ', icon: 'health' },
  amRecord:     { href: dailyPaths.support,      label: '支援記録へ',     icon: 'record' },
  lunchCheck:   { href: dailyPaths.support,      label: '支援記録へ',     icon: 'record' },
  pmRecord:     { href: dailyPaths.support,      label: '支援記録へ',     icon: 'record' },
  discharge:    { href: dailyPaths.attendance,   label: '退所確認へ',     icon: 'attendance' },
};

/**
 * opsStep から NextActionCard のナビゲーション先を解決する。
 * 該当なしの場合は /schedules のデフォルトリンクを返す。
 */
export function resolveOpsNavTarget(opsStep?: string): OpsNavTarget {
  if (opsStep && OPS_STEP_NAV[opsStep]) {
    return OPS_STEP_NAV[opsStep];
  }
  // opsStep なし or マッピング外 → スケジュール詳細
  return { href: '/schedules', label: '予定を確認', icon: 'schedule' };
}

// ─── Iceberg PDCA Navigation ──────────────────────────────────────────

/**
 * /analysis/iceberg-pdca?userId=xxx を生成する。
 * Daily Support / Monitoring → Iceberg PDCA への導線で使用。
 * source を指定すると流入元追跡に利用できる。
 */
export function buildIcebergPdcaUrl(
  userId: string,
  options?: { source?: string; planningSheetId?: string },
): string {
  const search = new URLSearchParams();
  search.set('userId', userId);
  if (options?.source) {
    search.set('source', options.source);
  }
  if (options?.planningSheetId) {
    search.set('planningSheetId', options.planningSheetId);
  }
  return `/analysis/iceberg-pdca?${search.toString()}`;
}

// ─── ABC Record Deep Link ─────────────────────────────────────────────

/**
 * /abc-record?userId=xxx&recordId=yyy&source=zzz を生成する。
 * 支援計画シートの根拠ABCチップから ABcRecordPage への導線で使用。
 */
export function buildAbcRecordUrl(
  userId: string,
  options?: { recordId?: string; source?: string },
): string {
  const search = new URLSearchParams();
  search.set('userId', userId);
  if (options?.recordId) {
    search.set('recordId', options.recordId);
  }
  if (options?.source) {
    search.set('source', options.source);
  }
  return `/abc-record?${search.toString()}`;
}

// ─── Iceberg PDCA Deep Link ───────────────────────────────────────────

/**
 * /analysis/iceberg-pdca?userId=xxx&pdcaId=yyy&source=zzz を生成する。
 * 支援計画シートの根拠PDCAチップから IcebergPdcaPage への導線で使用。
 * 既存の buildIcebergPdcaUrl とは別に pdcaId パラメータをサポートする。
 */
export function buildIcebergPdcaUrlWithHighlight(
  userId: string,
  pdcaId: string,
  options?: { source?: string; planningSheetId?: string },
): string {
  const search = new URLSearchParams();
  search.set('userId', userId);
  search.set('pdcaId', pdcaId);
  if (options?.source) {
    search.set('source', options.source);
  }
  if (options?.planningSheetId) {
    search.set('planningSheetId', options.planningSheetId);
  }
  return `/analysis/iceberg-pdca?${search.toString()}`;
}

// ─── Support Plan Monitoring Navigation ───────────────────────────────

import { resolveTabRoute, serializeTabRoute } from '@/features/support-plan-guide/domain/tabRoute';

/**
 * /support-plan-guide?userId=xxx&tab=operations.monitoring を生成する。
 * Iceberg PDCA → Monitoring への導線で使用。
 *
 * 新形式 group.sub を使用。useDraftBootstrap の parseTabRoute が
 * 旧形式（monitoring）・新形式（operations.monitoring）を両方受け入れるため
 * 後方互換は維持される。
 */
export function buildSupportPlanMonitoringUrl(userId: string): string {
  const search = new URLSearchParams();
  search.set('userId', userId);
  const route = resolveTabRoute('monitoring');
  search.set('tab', route ? serializeTabRoute(route) : 'monitoring');
  return `/support-plan-guide?${search.toString()}`;
}
