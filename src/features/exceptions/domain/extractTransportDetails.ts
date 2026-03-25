/**
 * extractTransportDetails — Transport イベントから per-user 詳細を抽出する pure function
 *
 * ## 目的
 * buildTransportExceptions に渡す enrichment data を生成する。
 * aggregate な KpiAlert だけでは失われる「誰が・どの方向で・何分」の情報を復元し、
 * ExceptionCenter の表示を具体的かつ行動可能にする。
 *
 * ## 出力データ
 * - stale 停滞中のユーザー一覧（userCode, direction, minutesElapsed）
 * - sync-failed のユーザー一覧（userCode, direction, errorMessage）
 *
 * @see buildTransportExceptions.ts
 */

import type { TransportTelemetryEvent } from '@/features/today/transport/transportTelemetry';

// ── Output Types ────────────────────────────────────────────────────────────

export type StaleDetail = {
  userCode: string;
  direction: 'to' | 'from';
  minutesElapsed: number;
};

export type SyncFailDetail = {
  userCode: string;
  direction: 'to' | 'from';
  errorMessage: string;
};

export type TransportDetails = {
  /** 停滞中ユーザー（minutesElapsed 降順でソート済み） */
  staleUsers: StaleDetail[];
  /** 同期失敗ユーザー */
  syncFailedUsers: SyncFailDetail[];
};

// ── Core Function ───────────────────────────────────────────────────────────

/**
 * Transport テレメトリイベントから per-user 詳細を抽出する。
 *
 * stale イベントは同一ユーザー・方向で最新（minutesElapsed 最大）のものだけ残す。
 * sync-failed は全件保持する（件数が少ないため）。
 */
export function extractTransportDetails(
  events: TransportTelemetryEvent[],
): TransportDetails {
  // ── stale: 同一ユーザー × 方向で最大 elapsed のものだけ残す ──
  const staleMap = new Map<string, StaleDetail>();

  for (const event of events) {
    if (event.type === 'transport:stale-in-progress') {
      const key = `${event.userCode}_${event.direction}`;
      const existing = staleMap.get(key);
      if (!existing || event.minutesElapsed > existing.minutesElapsed) {
        staleMap.set(key, {
          userCode: event.userCode,
          direction: event.direction,
          minutesElapsed: event.minutesElapsed,
        });
      }
    }
  }

  // minutesElapsed 降順（最も深刻なものが先頭）
  const staleUsers = Array.from(staleMap.values())
    .sort((a, b) => b.minutesElapsed - a.minutesElapsed);

  // ── sync-failed: 全件保持（重複除去は userCode + direction） ──
  const syncFailMap = new Map<string, SyncFailDetail>();
  for (const event of events) {
    if (event.type === 'transport:sync-failed') {
      const key = `${event.userCode}_${event.direction}`;
      if (!syncFailMap.has(key)) {
        syncFailMap.set(key, {
          userCode: event.userCode,
          direction: event.direction,
          errorMessage: event.errorMessage,
        });
      }
    }
  }

  return {
    staleUsers,
    syncFailedUsers: Array.from(syncFailMap.values()),
  };
}
