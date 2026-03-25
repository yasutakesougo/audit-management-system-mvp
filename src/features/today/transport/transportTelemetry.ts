/**
 * Transport Telemetry — イベント型定義 + 記録関数
 *
 * 送迎状況の運用監視データを Firestore telemetry コレクションに記録する。
 * Fire-and-forget: 書き込み失敗は console.warn のみ。UI をブロックしない。
 *
 * 観測イベント:
 * 1. sync-failed      — AttendanceDaily 同期失敗
 * 2. fallback-all-users — AttendanceUsers フォールバック発動
 * 3. status-transition  — ステータス遷移（正常系カウント）
 * 4. stale-in-progress  — 30分以上 in-progress 継続
 *
 * @see transport_telemetry_design.md
 */
import { db } from '@/infra/firestore/client';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import type { TransportDirection, TransportLegStatus } from './transportTypes';

// ── Event Source ─────────────────────────────────────────────────────────────

export type TransportTelemetrySource =
  | 'useTransportStatus'
  | 'transportRepo'
  | 'transportTimer';

// ── Base Event ──────────────────────────────────────────────────────────────

type BaseTransportTelemetryEvent = {
  eventVersion: 1;
  source: TransportTelemetrySource;
  clientTs: string;
};

// ── Event Types ─────────────────────────────────────────────────────────────

export type TransportSyncFailedEvent = BaseTransportTelemetryEvent & {
  type: 'transport:sync-failed';
  userCode: string;
  recordDate: string;
  direction: TransportDirection;
  errorMessage: string;
  errorStatus?: number;
};

export type TransportFallbackEvent = BaseTransportTelemetryEvent & {
  type: 'transport:fallback-all-users';
  reason: 'list-not-found' | 'fetch-error';
  totalUsersShown: number;
};

export type TransportTransitionEvent = BaseTransportTelemetryEvent & {
  type: 'transport:status-transition';
  userCode: string;
  direction: TransportDirection;
  fromStatus: TransportLegStatus;
  toStatus: TransportLegStatus;
};

export type TransportStaleEvent = BaseTransportTelemetryEvent & {
  type: 'transport:stale-in-progress';
  userCode: string;
  direction: TransportDirection;
  minutesElapsed: number;
};

export type TransportTelemetryEvent =
  | TransportSyncFailedEvent
  | TransportFallbackEvent
  | TransportTransitionEvent
  | TransportStaleEvent;

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * stale-in-progress 用の重複抑制キーを生成する。
 * 15分バケット刻みで再通知を許可する。
 *
 * キー形式: {userCode}_{recordDate}_{direction}_{bucket}
 * bucket: floor(minutesElapsed / 15) → 30分=2, 45分=3, 60分=4, ...
 */
export function getTransportStaleDedupKey(
  userCode: string,
  recordDate: string,
  direction: TransportDirection,
  minutesElapsed: number,
): string {
  const bucket = Math.floor(minutesElapsed / 15);
  return `${userCode}_${recordDate}_${direction}_${bucket}`;
}

// ── Record Function ─────────────────────────────────────────────────────────

const LOG = '[transport:telemetry]';

/**
 * Fire-and-forget: Firestore `telemetry` コレクションに Transport イベントを書き込む。
 * エラーは console.warn のみ。UI に影響を与えない。
 */
export function trackTransportEvent(event: TransportTelemetryEvent): void {
  const payload = {
    ...event,
    ts: serverTimestamp(),
  };

  try {
    addDoc(collection(db, 'telemetry'), payload).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn(`${LOG} write failed`, err);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`${LOG} skipped (db not ready)`, err);
  }
}
