/**
 * useCallLogsSummary — CallLog 集計 Hook（Today 連携用）
 *
 * 責務:
 * - "all" タブで全ログを取得
 * - 集計ヘルパーで件数を計算して返す
 * - Today ページが receive するだけの state を組み立てる
 *
 * 設計:
 * - useCallLogs の薄いラッパー（重複フェッチなし）
 * - pure helper で集計するため UI はこの hook を受け取って表示だけする
 */

import { useMemo } from 'react';
import { useCallLogs } from './useCallLogs';
import {
  countOpenCallLogs,
  countUrgentOpenCallLogs,
  countCallbackPendingCallLogs,
  countMyOpenCallLogs,
  countOverdueCallLogs,
} from '@/domain/callLogs/schema';

// ─── Return Type ──────────────────────────────────────────────────────────────

export type CallLogsSummary = {
  /** 全未対応件数（status !== 'done'） */
  openCount: number;
  /** 至急かつ未対応の件数 */
  urgentCount: number;
  /** 折返し待ち件数 */
  callbackPendingCount: number;
  /** 自分宛かつ未対応の件数（myName が空の場合は 0） */
  myOpenCount: number;
  /** 折返し期限超過件数（status === callback_pending かつ callbackDueAt が過去） */
  overdueCount: number;
  /** データ取得中かどうか */
  isLoading: boolean;
  /** エラーオブジェクト（発生時のみ） */
  error: Error | null;
};

// ─── Options ─────────────────────────────────────────────────────────────────

export type UseCallLogsSummaryOptions = {
  /**
   * ログインユーザーの表示名。
   * 一致する targetStaffName のログのみ myOpenCount に含める。
   * 空文字または未指定の場合、myOpenCount は常に 0。
   */
  myName?: string;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCallLogsSummary(options: UseCallLogsSummaryOptions = {}): CallLogsSummary {
  const { logs, isLoading, error } = useCallLogs({ activeTab: 'all' });
  const myName = options.myName ?? '';

  const summary = useMemo((): CallLogsSummary => {
    const safeLogs = logs ?? [];
    return {
      openCount: countOpenCallLogs(safeLogs),
      urgentCount: countUrgentOpenCallLogs(safeLogs),
      callbackPendingCount: countCallbackPendingCallLogs(safeLogs),
      myOpenCount: countMyOpenCallLogs(safeLogs, myName),
      overdueCount: countOverdueCallLogs(safeLogs),
      isLoading,
      error: error instanceof Error ? error : error ? new Error(String(error)) : null,
    };
  }, [logs, isLoading, error, myName]);

  return summary;
}
