// ---------------------------------------------------------------------------
// useAnalysisDashboardViewModel — Bento Grid ダッシュボード用 ViewModel
//
// 既存ストアからデータを受け取り、KPI / ヒートマップ / ドーナツ / トレンド を
// 「描画するだけのプレーンなデータ」に変換して返す B-layer フック。
// ---------------------------------------------------------------------------

import type { BehaviorObservation } from '@/features/daily';
import { useMemo } from 'react';
import type { DailyBehaviorStat } from './useBehaviorAnalytics';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** KPI カード1枚分 */
export type KpiCard = {
  label: string;
  value: number | string;
  unit?: string;
  trend?: 'up' | 'down' | 'flat';
  color: string;
};

/** ヒートマップ 1セル分 (24時間 × 7曜日 or 24時間フラット) */
export type HeatmapCell = {
  hour: number;
  count: number;
  /** 0.0 ~ 1.0 正規化された強度 */
  intensity: number;
};

/** ドーナツチャートのセグメント */
export type DonutSegment = {
  label: string;
  value: number;
  color: string;
  percentage: number;
};

/** 最近のイベント (タイムライン用) */
export type RecentEvent = {
  id: string;
  behavior: string;
  time: string;
  intensity: number;
  dateLabel: string;
};

/** 出欠サマリーの入力（ViewModel 用の軽量型） */
export type AttendanceVisitInput = {
  status: string;
  temperature?: number;
  eveningChecked?: boolean;
};

/** 出欠サマリー集計結果 */
export type AttendanceSummaryData = {
  attending: number;      // 通所中 + 退所済
  absent: number;         // 当日欠席 + 事前欠席
  undecided: number;      // その他
  feverCount: number;     // 37.5℃以上
  eveningPending: number; // 欠席者で夕方フォロー未完了
  donut: DonutSegment[];  // 出欠割合ドーナツ用
};

/** ViewModel 全体 */
export type AnalysisDashboardViewModel = {
  kpis: KpiCard[];
  heatmap: HeatmapCell[];
  donut: DonutSegment[];
  trend: DailyBehaviorStat[];
  recentEvents: RecentEvent[];
  attendanceSummary?: AttendanceSummaryData;
  hasData: boolean;
};

// ---------------------------------------------------------------------------
// Pure helpers (testable)
// ---------------------------------------------------------------------------

/** 発熱閾値 — useAttendanceAnalytics.ts と統一 */
const FEVER_THRESHOLD = 37.5;

/** 出欠サマリーを O(N) 1ループで集計 */
export function buildAttendanceSummaryData(
  visits: Record<string, AttendanceVisitInput>,
): AttendanceSummaryData {
  let attending = 0;
  let absent = 0;
  let undecided = 0;
  let feverCount = 0;
  let eveningPending = 0;

  for (const visit of Object.values(visits)) {
    // 1. 出欠ステータス
    if (visit.status === '通所中' || visit.status === '退所済') {
      attending++;
    } else if (visit.status === '当日欠席' || visit.status === '事前欠席') {
      absent++;
      // 夕方フォロー未完了（欠席者のみ対象）
      if (visit.eveningChecked !== true) {
        eveningPending++;
      }
    } else {
      undecided++;
    }

    // 2. 発熱判定
    if (visit.temperature != null && visit.temperature >= FEVER_THRESHOLD) {
      feverCount++;
    }
  }

  const total = attending + absent + undecided;
  const pct = (n: number) => (total > 0 ? Number(((n / total) * 100).toFixed(1)) : 0);

  return {
    attending,
    absent,
    undecided,
    feverCount,
    eveningPending,
    donut: [
      { label: '通所', value: attending, color: '#5B8C5A', percentage: pct(attending) },
      { label: '欠席', value: absent, color: '#d32f2f', percentage: pct(absent) },
      { label: '未定', value: undecided, color: '#9E9E9E', percentage: pct(undecided) },
    ],
  };
}

/** 24時間ヒートマップを生成 */
export function buildHourlyHeatmap(records: BehaviorObservation[]): HeatmapCell[] {
  const buckets = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0, intensity: 0 }));

  for (const r of records) {
    const d = new Date(r.recordedAt);
    if (Number.isNaN(d.getTime())) continue;
    const h = d.getHours();
    buckets[h].count += 1;
  }

  const max = Math.max(...buckets.map((b) => b.count), 1);
  for (const b of buckets) {
    b.intensity = Number((b.count / max).toFixed(2));
  }

  return buckets;
}

/** ドーナツデータを生成 */
export function buildDonutData(
  completed: number,
  triggered: number,
  skipped: number,
): DonutSegment[] {
  const total = completed + triggered + skipped;
  if (total === 0) {
    return [
      { label: '完了', value: 0, color: '#5B8C5A', percentage: 0 },
      { label: '発動', value: 0, color: '#FF9800', percentage: 0 },
      { label: 'スキップ', value: 0, color: '#9E9E9E', percentage: 0 },
    ];
  }
  const pct = (n: number) => Number(((n / total) * 100).toFixed(1));
  return [
    { label: '完了', value: completed, color: '#5B8C5A', percentage: pct(completed) },
    { label: '発動', value: triggered, color: '#FF9800', percentage: pct(triggered) },
    { label: 'スキップ', value: skipped, color: '#9E9E9E', percentage: pct(skipped) },
  ];
}

/** 最近のイベント (最新10件) */
export function buildRecentEvents(records: BehaviorObservation[], limit = 10): RecentEvent[] {
  const fmt = new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return [...records]
    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
    .slice(0, limit)
    .map((r) => {
      const d = new Date(r.recordedAt);
      return {
        id: r.id,
        behavior: r.behavior,
        time: fmt.format(d),
        intensity: r.intensity,
        dateLabel: d.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
      };
    });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAnalysisDashboardViewModel(
  analysisData: BehaviorObservation[],
  dailyStats: DailyBehaviorStat[],
  executionStats: { completed: number; triggered: number; skipped: number; total: number },
  activeBipCount: number,
  attendanceVisits?: Record<string, AttendanceVisitInput>,
  /** IBD 対象者の UserCode セット。指定時は出欠サマリーを IBD ユーザーのみに絞る */
  ibdUserCodes?: Set<string>,
): AnalysisDashboardViewModel {
  return useMemo(() => {
    const totalIncidents = analysisData.length;
    const avgIntensity =
      totalIncidents > 0
        ? Number((analysisData.reduce((sum, r) => sum + r.intensity, 0) / totalIncidents).toFixed(1))
        : 0;

    const completionRate =
      executionStats.total > 0
        ? Number(((executionStats.completed / executionStats.total) * 100).toFixed(0))
        : 0;

    // --- Trend direction (compare last 7 days vs previous 7 days) ---
    const midpoint = Math.floor(dailyStats.length / 2);
    const recentHalf = dailyStats.slice(midpoint);
    const olderHalf = dailyStats.slice(0, midpoint);
    const avgRecent = recentHalf.length > 0
      ? recentHalf.reduce((s, d) => s + d.count, 0) / recentHalf.length
      : 0;
    const avgOlder = olderHalf.length > 0
      ? olderHalf.reduce((s, d) => s + d.count, 0) / olderHalf.length
      : 0;
    const incidentTrend: 'up' | 'down' | 'flat' =
      avgRecent > avgOlder * 1.1 ? 'up' : avgRecent < avgOlder * 0.9 ? 'down' : 'flat';

    const kpis: KpiCard[] = [
      {
        label: '行動発生件数',
        value: totalIncidents,
        unit: '件',
        trend: incidentTrend,
        color: '#d32f2f',
      },
      {
        label: '平均強度',
        value: avgIntensity,
        unit: '/ 5',
        trend: 'flat',
        color: '#FF9800',
      },
      {
        label: '手順実施率',
        value: `${completionRate}`,
        unit: '%',
        trend: completionRate >= 80 ? 'up' : 'flat',
        color: '#5B8C5A',
      },
      {
        label: 'アクティブBIP',
        value: activeBipCount,
        unit: '件',
        color: '#1976d2',
      },
    ];

    const heatmap = buildHourlyHeatmap(analysisData);
    const donut = buildDonutData(
      executionStats.completed,
      executionStats.triggered,
      executionStats.skipped,
    );
    const recentEvents = buildRecentEvents(analysisData);

    // IBD 対象者のみにフィルタリング（ibdUserCodes が指定されている場合）
    const filteredVisits = attendanceVisits
      ? ibdUserCodes
        ? Object.entries(attendanceVisits).reduce((acc, [userCode, visit]) => {
            if (ibdUserCodes.has(userCode)) acc[userCode] = visit;
            return acc;
          }, {} as Record<string, AttendanceVisitInput>)
        : attendanceVisits
      : undefined;

    const attendanceSummary = filteredVisits
      ? buildAttendanceSummaryData(filteredVisits)
      : undefined;

    return {
      kpis,
      heatmap,
      donut,
      trend: dailyStats,
      recentEvents,
      attendanceSummary,
      hasData: totalIncidents > 0 || executionStats.total > 0,
    };
  }, [analysisData, dailyStats, executionStats, activeBipCount, attendanceVisits, ibdUserCodes]);
}
