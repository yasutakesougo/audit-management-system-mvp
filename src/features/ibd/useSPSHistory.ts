// ---------------------------------------------------------------------------
// useSPSHistory — SPS 改訂履歴フック
// ---------------------------------------------------------------------------
import { useCallback, useMemo, useState } from 'react';

import {
    getLatestSPS,
    getSPSHistory,
    getSPSHistoryForUser,
    reviseSPS,
} from './ibdStore';
import type { SPSHistoryEntry, SupportPlanSheet } from './ibdTypes';

export interface SPSHistoryState {
  /** 指定 SPS の改訂履歴 */
  history: SPSHistoryEntry[];
  /** 件数 */
  count: number;
}

/**
 * 特定 SPS の改訂履歴を取得するフック
 */
export function useSPSHistoryBySPS(spsId: string | null): SPSHistoryState {
  return useMemo(() => {
    if (!spsId) return { history: [], count: 0 };
    const history = getSPSHistory(spsId);
    return { history, count: history.length };
  }, [spsId]);
}

/**
 * 特定利用者の改訂履歴を取得するフック
 */
export function useSPSHistoryByUser(userId: number | null): SPSHistoryState {
  return useMemo(() => {
    if (userId === null) return { history: [], count: 0 };
    const history = getSPSHistoryForUser(userId);
    return { history, count: history.length };
  }, [userId]);
}

/**
 * 特定利用者の最新 SPS を取得するフック
 */
export function useLatestSPS(userId: number | null): SupportPlanSheet | null {
  return useMemo(() => {
    if (userId === null) return null;
    return getLatestSPS(userId) ?? null;
  }, [userId]);
}

export interface SPSRevisionResult {
  /** 改訂を実行する */
  revise: (
    spsId: string,
    revisedBy: number | null,
    revisionReason: string,
    changesSummary: string,
  ) => boolean;
  /** 実行中フラグ */
  isRevising: boolean;
}

/**
 * SPS 改訂を実行するフック
 */
export function useSPSRevision(): SPSRevisionResult {
  const [isRevising, setIsRevising] = useState(false);

  const revise = useCallback(
    (
      spsId: string,
      revisedBy: number | null,
      revisionReason: string,
      changesSummary: string,
    ) => {
      setIsRevising(true);
      try {
        return reviseSPS(spsId, revisedBy, revisionReason, changesSummary);
      } finally {
        setIsRevising(false);
      }
    },
    [],
  );

  return { revise, isRevising };
}
