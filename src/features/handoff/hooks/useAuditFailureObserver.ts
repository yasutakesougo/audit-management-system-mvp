/**
 * useAuditFailureObserver — 監査ログ永続化失敗の観測フック
 *
 * Phase 2 (B-3): 監査失敗観測
 *
 * fire-and-forget の監査ログ書き込みが失敗した場合の統計を提供。
 * UI でトースト等による通知を出すことで、サイレント障害を防止。
 *
 * 設計方針:
 * - 失敗カウントと最終失敗情報をメモリ上で保持
 * - セッション単位（リロードでリセット）— 永続化は persistentLogger 側で担当
 * - コンポーネントからは read-only な状態として利用
 */

import { useCallback, useRef, useState } from 'react';
import type { AuditPersistErrorClass } from '../actions/handoffActions.logger';
import { classifyAuditPersistError, logAuditPersistFailed } from '../actions/handoffActions.logger';

// ────────────────────────────────────────────────────────────

export type AuditFailureInfo = {
  handoffId: number;
  action: 'creation' | 'status_change';
  errorClass: AuditPersistErrorClass;
  message: string;
  timestamp: string;
};

export type AuditFailureStats = {
  /** セッション中の失敗回数 */
  failureCount: number;
  /** 最後の失敗情報（null = 失敗なし） */
  lastFailure: AuditFailureInfo | null;
  /** 失敗カウントをリセット（確認済み後に呼ぶ） */
  acknowledge: () => void;
};

// ────────────────────────────────────────────────────────────

export function useAuditFailureObserver(): {
  stats: AuditFailureStats;
  /**
   * 監査ログ永続化を実行し、失敗時に observer に記録する。
   * `useHandoffTimeline.ts` の `.catch()` コールバックの代替。
   */
  wrapAuditPersist: (
    promise: Promise<unknown>,
    handoffId: number,
    action: 'creation' | 'status_change',
  ) => void;
} {
  const [failureCount, setFailureCount] = useState(0);
  const [lastFailure, setLastFailure] = useState<AuditFailureInfo | null>(null);
  const countRef = useRef(0);

  const wrapAuditPersist = useCallback(
    (promise: Promise<unknown>, handoffId: number, action: 'creation' | 'status_change') => {
      promise.catch((e: unknown) => {
        const errorClass = classifyAuditPersistError(e);
        const message = e instanceof Error ? e.message : String(e);

        // 構造化ログを残す（既存の logger 基盤を利用）
        logAuditPersistFailed({
          handoffId,
          action,
          errorClass,
          message,
        });

        // セッション内カウンターを更新
        countRef.current += 1;
        const info: AuditFailureInfo = {
          handoffId,
          action,
          errorClass,
          message,
          timestamp: new Date().toISOString(),
        };
        setFailureCount(countRef.current);
        setLastFailure(info);
      });
    },
    [],
  );

  const acknowledge = useCallback(() => {
    countRef.current = 0;
    setFailureCount(0);
    setLastFailure(null);
  }, []);

  return {
    stats: {
      failureCount,
      lastFailure,
      acknowledge,
    },
    wrapAuditPersist,
  };
}
