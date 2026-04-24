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
import { useTransportStatus } from '@/features/today/transport';
import { spTelemetryStore } from '@/lib/telemetry/spTelemetryStore';
import {
  buildVehicleBoardGroups,
  DEFAULT_TRANSPORT_VEHICLE_IDS,
  hasMissingVehicleDriver,
} from '@/features/today/transport/transportAssignments';
import type { MissingDriverDetail } from '@/features/exceptions/domain/buildTransportExceptions';

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
  const transportStatus = useTransportStatus();

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
  const missingDriverUsers = useMemo<MissingDriverDetail[]>(() => {
    if (!transportStatus.isReady) return [];

    const groups = buildVehicleBoardGroups(
      transportStatus.status.legs,
      DEFAULT_TRANSPORT_VEHICLE_IDS,
    );

    const details: MissingDriverDetail[] = [];
    for (const group of groups) {
      if (!hasMissingVehicleDriver(group)) continue;

      for (const rider of group.riders) {
        details.push({
          userCode: rider.userId,
          userName: rider.userName,
          direction: rider.direction,
          vehicleId: group.vehicleId,
        });
      }
    }
    return details;
  }, [transportStatus.isReady, transportStatus.status.legs]);

  const items = useMemo(() => {
    const kpis = computeTransportKpis(events);
    const alerts = computeTransportAlerts({
      kpis,
      now: new Date(),
    });
    const missingVehicles = new Set(missingDriverUsers.map((d) => d.vehicleId));
    const mergedAlerts = [...alerts];
    if (missingDriverUsers.length > 0) {
      mergedAlerts.push({
        id: 'transport-missing-driver-assignment',
        severity: 'warning',
        label: '運転者未設定の配車',
        message: `運転者未設定の車両が ${missingVehicles.size} 台、対象 ${missingDriverUsers.length} 名あります。配車を確認してください。`,
        value: missingDriverUsers.length,
        threshold: 0,
      });
    }

    if (mergedAlerts.length === 0 && spTelemetryStore.getAssignmentConflictEvents().length === 0) return [];

    const details = extractTransportDetails(events);
    const assignmentConflictEvents = spTelemetryStore.getAssignmentConflictEvents();

    return buildTransportExceptions({
      alerts: mergedAlerts,
      today,
      details,
      missingDriverUsers,
      userNames,
      assignmentConflictEvents,
    });
  }, [events, missingDriverUsers, today, userNames]);

  return { items, status };
}
