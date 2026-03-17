/**
 * buildTimeline — 4ドメインを統合する純粋関数
 *
 * Daily / Incident / ISP / Handoff のレコードを受け取り、
 * 各 adapter で TimelineEvent に変換 → merge → filter → sort する。
 *
 * 設計方針:
 *   - 純粋関数（副作用なし、テスト容易）
 *   - Handoff の userCode → userId 変換は ResolveUserIdFromCode で注入
 *   - フィルタは client-side で完結（Phase 1）
 *   - ソートは occurredAt 降順（直近のイベントを上位に）
 */

import type { AnyDaily } from '@/domain/daily/types';
import type { HighRiskIncident } from '@/domain/support/highRiskIncident';
import type { IndividualSupportPlan } from '@/domain/isp/schema';
import type { HandoffRecord } from '@/features/handoff/handoffTypes';
import type {
  TimelineEvent,
  TimelineFilter,
  TimelineSeverity,
  ResolveUserIdFromCode,
} from './types';
import {
  dailyToTimelineEvent,
  incidentToTimelineEvent,
  ispToTimelineEvent,
  handoffToTimelineEvent,
} from './adapters';

// ─────────────────────────────────────────────
// 入力型
// ─────────────────────────────────────────────

/** 4ドメインのソースデータ */
export type TimelineSources = {
  dailyRecords?: AnyDaily[];
  incidents?: HighRiskIncident[];
  ispRecords?: IndividualSupportPlan[];
  handoffRecords?: HandoffRecord[];
};

/** buildTimeline のオプション */
export type TimelineOptions = {
  /** フィルタ条件 */
  filter?: TimelineFilter;
  /**
   * Handoff の userCode → userId 変換関数。
   * 省略時は identity (code => code) として扱う。
   */
  resolveUserIdFromCode?: ResolveUserIdFromCode;
};

// ─────────────────────────────────────────────
// severity 比較用の重み
// ─────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<TimelineSeverity, number> = {
  info: 0,
  warning: 1,
  critical: 2,
};

// ─────────────────────────────────────────────
// フィルタ適用
// ─────────────────────────────────────────────

function applyFilter(
  events: TimelineEvent[],
  filter: TimelineFilter,
): TimelineEvent[] {
  let result = events;

  // source filter
  if (filter.sources && filter.sources.length > 0) {
    const allowed = new Set(filter.sources);
    result = result.filter((e) => allowed.has(e.source));
  }

  // date range filter
  if (filter.from) {
    const from = filter.from;
    result = result.filter((e) => e.occurredAt >= from);
  }
  if (filter.to) {
    const to = filter.to;
    result = result.filter((e) => e.occurredAt <= to);
  }

  // severity filter (指定以上のみ)
  if (filter.severity) {
    const minWeight = SEVERITY_WEIGHT[filter.severity];
    result = result.filter(
      (e) => SEVERITY_WEIGHT[e.severity] >= minWeight,
    );
  }

  return result;
}

// ─────────────────────────────────────────────
// buildTimeline
// ─────────────────────────────────────────────

/**
 * 4ドメインのソースデータを統合してタイムラインを構築する。
 *
 * @param sources - 各ドメインのレコード配列（省略可能）
 * @param options - フィルタ条件 + Handoff userCode 変換関数
 * @returns occurredAt 降順にソートされた TimelineEvent 配列
 *
 * @example
 * ```ts
 * const events = buildTimeline(
 *   { dailyRecords, incidents, handoffRecords },
 *   {
 *     filter: { sources: ['daily', 'incident'] },
 *     resolveUserIdFromCode: (code) => userMasterMap.get(code)?.userId ?? null,
 *   },
 * );
 * ```
 */
export function buildTimeline(
  sources: TimelineSources,
  options?: TimelineOptions,
): TimelineEvent[] {
  const resolveUserId: ResolveUserIdFromCode =
    options?.resolveUserIdFromCode ?? ((code) => code);

  // 1. 各 adapter で変換
  const events: TimelineEvent[] = [
    ...(sources.dailyRecords ?? []).map(dailyToTimelineEvent),
    ...(sources.incidents ?? []).map(incidentToTimelineEvent),
    ...(sources.ispRecords ?? []).map(ispToTimelineEvent),
    ...(sources.handoffRecords ?? [])
      .map((h) => handoffToTimelineEvent(h, resolveUserId))
      .filter((e): e is TimelineEvent => e !== null),
  ];

  // 2. フィルタ適用
  const filtered = options?.filter
    ? applyFilter(events, options.filter)
    : events;

  // 3. occurredAt 降順ソート（直近が先頭）
  return filtered.sort((a, b) =>
    b.occurredAt.localeCompare(a.occurredAt),
  );
}
