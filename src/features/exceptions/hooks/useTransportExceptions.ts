/**
 * useTransportExceptions — ExceptionCenter 用の Transport Alert 統合 hook
 *
 * Firestore の telemetry コレクションから transport 関連イベントを取得し、
 * KPI 集計 → Alert 判定 → per-user 詳細抽出 → ExceptionItem 変換のパイプラインを実行する。
 *
 * ## v2: per-user enrichment
 * extractTransportDetails で stale / sync-failed の個別ユーザー情報を抽出し、
 * buildTransportExceptions に渡す。これにより ExceptionCenter に
 * 「誰の・どの方向の送迎が・何分停滞中」まで表示される。
 *
 * ## 設計意図
 * - ExceptionCenterPage に最小限の transport 監視結果を提供する
 * - 既存の pure function を再利用してパイプラインを構成
 * - useTelemetryDashboard への依存は避け、必要最小限のデータだけ取得する
 *
 * @see buildTransportExceptions.ts
 * @see extractTransportDetails.ts
 * @see computeTransportAlerts.ts
 */

import { useEffect, useMemo, useState } from 'react';
import { db } from '@/infra/firestore/client';
import { useUsers } from '@/features/users/useUsers';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { computeTransportKpis } from '@/features/today/transport/computeTransportKpis';
import { computeTransportAlerts } from '@/features/today/transport/computeTransportAlerts';
import { buildTransportExceptions } from '@/features/exceptions/domain/buildTransportExceptions';
import { extractTransportDetails } from '@/features/exceptions/domain/extractTransportDetails';
import type { ExceptionItem } from '@/features/exceptions/domain/exceptionLogic';
import type { TransportTelemetryEvent } from '@/features/today/transport/transportTelemetry';

export interface UseTransportExceptionsReturn {
  /** ExceptionItem に変換済みの送迎アラート */
  items: ExceptionItem[];
  /** 取得状態 */
  status: 'idle' | 'loading' | 'ready' | 'error';
}

/**
 * Transport テレメトリ → ExceptionItem 統合 hook
 *
 * Pipeline: Firestore events → KPIs → Alerts → Details → ExceptionItems
 */
export function useTransportExceptions(): UseTransportExceptionsReturn {
  const [events, setEvents] = useState<TransportTelemetryEvent[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  // ── ユーザーマスタから UserID → FullName マップを生成 ──
  const { data: users } = useUsers();
  const userNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const u of users) {
      if (u.UserID && u.FullName) {
        map[u.UserID] = u.FullName;
      }
    }
    return map;
  }, [users]);

  const today = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // ── Firestore から transport イベントを取得 ──
  // useTelemetryDashboard と同じパターン: 全取得後に type でフィルタ
  useEffect(() => {
    let cancelled = false;

    const TRANSPORT_TYPES = [
      'transport:sync-failed',
      'transport:fallback-all-users',
      'transport:status-transition',
      'transport:stale-in-progress',
    ];

    async function fetchTransportEvents() {
      setStatus('loading');
      try {
        const colRef = collection(db, 'telemetry');
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const q = query(
          colRef,
          where('timestamp', '>=', todayStart),
          orderBy('timestamp', 'desc'),
          limit(500),
        );

        const snapshot = await getDocs(q);
        if (cancelled) return;

        // useTelemetryDashboard と同じキャストパターン
        const transportEvents: TransportTelemetryEvent[] = [];
        for (const doc of snapshot.docs) {
          const data = doc.data();
          if (TRANSPORT_TYPES.includes(data.type)) {
            transportEvents.push(data as TransportTelemetryEvent);
          }
        }

        setEvents(transportEvents);
        setStatus('ready');
      } catch {
        if (!cancelled) {
          setStatus('error');
        }
      }
    }

    fetchTransportEvents();
    return () => { cancelled = true; };
  }, []);

  // ── Pipeline: events → KPIs → Alerts → Details → ExceptionItems ──
  const items = useMemo(() => {
    if (events.length === 0) return [];

    const kpis = computeTransportKpis(events);
    const alerts = computeTransportAlerts({
      kpis,
      now: new Date(),
    });
    const details = extractTransportDetails(events);

    return buildTransportExceptions({
      alerts,
      today,
      details,
      userNames,
    });
  }, [events, today, userNames]);

  return { items, status };
}
