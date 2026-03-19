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

// ── Types ───────────────────────────────────────────────────────────────────

export type DateRange = 'today' | '7d' | '30d';

export type TelemetryDoc = {
  id: string;
  type: string;
  event?: string;
  phase?: string;
  path?: string;
  screen?: string;
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
  return {
    id,
    type: data.type ?? 'unknown',
    event: data.event,
    phase: data.phase,
    path: data.path ?? data.screen,
    screen: data.screen,
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

      const q = query(
        col,
        where('ts', '>=', rangeStart),
        orderBy('ts', 'desc'),
        limit(maxDocs),
      );

      const snapshot = await getDocs(q);
      const docs = snapshot.docs.map((d) => docToTelemetry(d.id, d.data()));

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
        loading: false,
        error: null,
        range,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[telemetry-dashboard] fetch failed:', err);
      setState((prev) => ({ ...prev, stats: null, loading: false, error: msg }));
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
