/**
 * useTelemetryDashboard — Firestore telemetry コレクションからダッシュボード用データを取得
 *
 * 機能:
 * - 期間別集計（今日 / 7日 / 30日）
 * - type 別イベント数
 * - phase 分布
 * - event 別ランキング（type×event 組み合わせ）
 * - 最新10件のイベント一覧
 */
import { db } from '@/infra/firestore/client';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { computeCtaKpis, type DashboardKpis } from '../domain/computeCtaKpis';
import { computeCtaKpiDiff, type DashboardKpiDiffs } from '../domain/computeCtaKpiDiff';
import { computeCtaKpisByRole, type RoleBreakdown } from '../domain/computeCtaKpisByRole';

// ── Types ───────────────────────────────────────────────────────────────────

export type DateRange = 'today' | '7d' | '30d';

export type TelemetryDoc = {
  id: string;
  type: string;
  event?: string;
  phase?: string;
  path?: string;
  screen?: string;
  role?: 'staff' | 'admin' | 'unknown';
  clientTs?: string;
  ts?: Date;
};

export type EventRankItem = {
  key: string;       // "type:event" or "type:(none)"
  type: string;
  event: string;
  count: number;
};

export type TelemetryStats = {
  total: number;
  byType: Record<string, number>;
  byPhase: Record<string, number>;
  eventRanking: EventRankItem[];
  latestEvents: TelemetryDoc[];
};

type DashboardState = {
  stats: TelemetryStats | null;
  kpis: DashboardKpis | null;
  kpiDiffs: DashboardKpiDiffs | null;
  roleBreakdown: RoleBreakdown;
  loading: boolean;
  error: string | null;
  range: DateRange;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function toDate(ts: unknown): Date | undefined {
  if (!ts) return undefined;
  if (ts instanceof Date) return ts;
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    return (ts as Timestamp).toDate();
  }
  if (typeof ts === 'string') return new Date(ts);
  return undefined;
}

function docToTelemetry(id: string, data: DocumentData): TelemetryDoc {
  const rawRole = data.role;
  const role: TelemetryDoc['role'] =
    rawRole === 'staff' || rawRole === 'admin' ? rawRole : 'unknown';
  return {
    id,
    type: data.type ?? 'unknown',
    event: data.event,
    phase: data.phase,
    path: data.path ?? data.screen,
    screen: data.screen,
    role,
    clientTs: data.clientTs,
    ts: toDate(data.ts),
  };
}

function getRangeStart(range: DateRange): Date {
  const now = new Date();
  switch (range) {
    case '7d':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);
    case '30d':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0);
    case 'today':
    default:
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }
}

/** 前期間の開始日を算出（同じ幅だけ前にずらす） */
function getPreviousRangeStart(range: DateRange): { start: Date; end: Date } {
  const now = new Date();
  switch (range) {
    case '7d': {
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7, 0, 0, 0, 0);
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14, 0, 0, 0, 0);
      return { start, end };
    }
    case '30d': {
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30, 0, 0, 0, 0);
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 60, 0, 0, 0, 0);
      return { start, end };
    }
    case 'today':
    default: {
      // 前日
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      return { start, end };
    }
  }
}

function getQueryLimit(range: DateRange): number {
  switch (range) {
    case '30d': return 2000;
    case '7d':  return 500;
    default:    return 200;
  }
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useTelemetryDashboard() {
  const [state, setState] = useState<DashboardState>({
    stats: null,
    kpis: null,
    kpiDiffs: null,
    roleBreakdown: [],
    loading: true,
    error: null,
    range: 'today',
  });

  const fetchData = useCallback(async (range: DateRange) => {
    setState((prev) => ({ ...prev, loading: true, error: null, range }));

    try {
      const col = collection(db, 'telemetry');
      const rangeStart = getRangeStart(range);
      const maxDocs = getQueryLimit(range);

      // ── 現在期間取得 ──
      const currentQuery = query(
        col,
        where('ts', '>=', rangeStart),
        orderBy('ts', 'desc'),
        limit(maxDocs),
      );

      // ── 前期間取得（並列） ──
      const prev = getPreviousRangeStart(range);
      const previousQuery = query(
        col,
        where('ts', '>=', prev.start),
        where('ts', '<', prev.end),
        orderBy('ts', 'desc'),
        limit(maxDocs),
      );

      const [currentSnapshot, previousSnapshot] = await Promise.all([
        getDocs(currentQuery),
        getDocs(previousQuery).catch(() => null), // 前期間取得失敗は無視
      ]);

      const docs = currentSnapshot.docs.map((d) => docToTelemetry(d.id, d.data()));

      // ── KPI 算出（pure function） ──
      const toKpiRecord = (d: TelemetryDoc) => ({
        type: d.type,
        ctaId: d.event,
        sourceComponent: d.screen,
        clientTs: d.clientTs,
        ts: d.ts,
        role: d.role,
      });
      const kpiRecords = docs.map(toKpiRecord);
      const kpis = computeCtaKpis(kpiRecords);

      // ── 前期間 KPI 算出 ──
      let previousKpis: DashboardKpis | null = null;
      if (previousSnapshot) {
        const prevDocs = previousSnapshot.docs.map((d) => docToTelemetry(d.id, d.data()));
        previousKpis = computeCtaKpis(prevDocs.map(toKpiRecord));
      }

      // ── Diff + Alerts 算出 ──
      const kpiDiffs = computeCtaKpiDiff(kpis, previousKpis);

      // ── Role Breakdown 算出 ──
      const roleBreakdown = computeCtaKpisByRole(kpiRecords);

      // ── 集計 ──
      const byType: Record<string, number> = {};
      const byPhase: Record<string, number> = {};
      const eventMap: Record<string, { type: string; event: string; count: number }> = {};

      for (const doc of docs) {
        // type 集計
        byType[doc.type] = (byType[doc.type] ?? 0) + 1;

        // phase 集計
        if (doc.phase) {
          byPhase[doc.phase] = (byPhase[doc.phase] ?? 0) + 1;
        }

        // event ランキング（type×event の組み合わせ）
        const eventName = doc.event ?? '(none)';
        const key = `${doc.type}:${eventName}`;
        if (!eventMap[key]) {
          eventMap[key] = { type: doc.type, event: eventName, count: 0 };
        }
        eventMap[key].count += 1;
      }

      // ランキングを件数降順にソート
      const eventRanking: EventRankItem[] = Object.entries(eventMap)
        .map(([key, v]) => ({ key, ...v }))
        .sort((a, b) => b.count - a.count);

      setState({
        stats: {
          total: docs.length,
          byType,
          byPhase,
          eventRanking,
          latestEvents: docs.slice(0, 10),
        },
        kpis,
        kpiDiffs,
        roleBreakdown,
        loading: false,
        error: null,
        range,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[telemetry-dashboard] fetch failed:', err);
      setState((prev) => ({ ...prev, stats: null, kpis: null, kpiDiffs: null, roleBreakdown: [], loading: false, error: msg }));
    }
  }, []);

  // 初回ロード（fetchData は useCallback([], []) で安定参照）
  useEffect(() => {
    void fetchData('today');
  }, [fetchData]);

  const setRange = useCallback((range: DateRange) => {
    void fetchData(range);
  }, [fetchData]);

  const refresh = useCallback(() => {
    void fetchData(state.range);
  }, [fetchData, state.range]);

  return { ...state, setRange, refresh };
}
