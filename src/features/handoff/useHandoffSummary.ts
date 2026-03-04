/**
 * 申し送りサマリー用フック（読み取り専用）
 *
 * 朝会・夕会システムで申し送り状況を表示するための軽量hook
 * useHandoffTimelineとは別で、統計情報のみ取得
 *
 * Phase 9: TanStack Query 移行
 * - useState + useEffect → useQuery
 * - キャッシュ無効化: handoffKeys.summary(scope) / handoffKeys.all
 * - staleTime 30s + refetchInterval 60s でKPIリアルタイム性確保
 * - computeSummary を純粋関数として分離（テスト容易性向上）
 */

import { useQuery } from '@tanstack/react-query';
import { useHandoffApi } from './handoffApi';
import { handoffConfig } from './handoffConfig';
import { handoffKeys } from './handoffQueryKeys';
import { isTerminalStatus } from './handoffStateMachine';
import { loadRecordsFromStorage } from './handoffStorageUtils';
import type { HandoffCategory, HandoffDayScope, HandoffRecord, HandoffStatus } from './handoffTypes';

// ────────────────────────────────────────────────────────────
// 型定義
// ────────────────────────────────────────────────────────────

export type HandoffSummaryData = {
  total: number;
  byStatus: Record<HandoffStatus, number>;
  /** severity === '重要' && 未完了 の件数 */
  criticalCount: number;
  /** カテゴリ別集計 */
  byCategory: Record<HandoffCategory, number>;
};

// ────────────────────────────────────────────────────────────
// 初期値 (ゼロ状態)
// ────────────────────────────────────────────────────────────

const EMPTY_SUMMARY: HandoffSummaryData = {
  total: 0,
  byStatus: {
    '未対応': 0,
    '対応中': 0,
    '対応済': 0,
    '確認済': 0,
    '明日へ持越': 0,
    '完了': 0,
  },
  criticalCount: 0,
  byCategory: {
    '体調': 0,
    '行動面': 0,
    '家族連絡': 0,
    '支援の工夫': 0,
    '良かったこと': 0,
    '事故・ヒヤリ': 0,
    'その他': 0,
  },
};

// ────────────────────────────────────────────────────────────
// 純粋関数: レコード配列 → サマリー集計
// ────────────────────────────────────────────────────────────

/**
 * HandoffRecord[] からサマリー統計を計算する（副作用なし）
 *
 * @pure — テスト可能
 */
export function computeHandoffSummary(items: HandoffRecord[]): HandoffSummaryData {
  let pending = 0;
  let inProgress = 0;
  let done = 0;
  let confirmed = 0;
  let carryOver = 0;
  let completed = 0;
  let critical = 0;

  const categoryCount: Record<HandoffCategory, number> = {
    '体調': 0,
    '行動面': 0,
    '家族連絡': 0,
    '支援の工夫': 0,
    '良かったこと': 0,
    '事故・ヒヤリ': 0,
    'その他': 0,
  };

  for (const item of items) {
    // 状態別カウント
    switch (item.status) {
      case '未対応':     pending++;    break;
      case '対応中':     inProgress++; break;
      case '対応済':     done++;       break;
      case '確認済':     confirmed++;  break;
      case '明日へ持越': carryOver++;  break;
      case '完了':       completed++;  break;
    }

    // 重要・未完了カウント (isTerminalStatus で終了判定)
    if (item.severity === '重要' && !isTerminalStatus(item.status)) {
      critical++;
    }

    // カテゴリ別カウント
    categoryCount[item.category]++;
  }

  return {
    total: items.length,
    byStatus: {
      '未対応': pending,
      '対応中': inProgress,
      '対応済': done,
      '確認済': confirmed,
      '明日へ持越': carryOver,
      '完了': completed,
    },
    criticalCount: critical,
    byCategory: categoryCount,
  };
}

// ────────────────────────────────────────────────────────────
// React Hook (TanStack Query ベース)
// ────────────────────────────────────────────────────────────

/**
 * 申し送りサマリー情報を取得するフック
 *
 * Phase 9: TanStack Query 移行 — キャッシュ無効化による
 * CommandBar KPI のリアルタイム反映を実現。
 *
 * 無効化方法:
 * ```ts
 * // 全 handoff キャッシュを無効化（作成・更新後に）
 * queryClient.invalidateQueries({ queryKey: handoffKeys.all });
 *
 * // サマリーだけ無効化
 * queryClient.invalidateQueries({ queryKey: handoffKeys.summaries() });
 * ```
 *
 * @param options dayScope指定可能（朝会=昨日、夕会=今日）
 */
export function useHandoffSummary(options?: { dayScope?: HandoffDayScope }): HandoffSummaryData {
  const dayScope = options?.dayScope ?? 'today';
  const handoffApi = useHandoffApi();

  const { data } = useQuery({
    queryKey: handoffKeys.summary(dayScope),
    queryFn: async (): Promise<HandoffSummaryData> => {
      let items: HandoffRecord[];

      if (handoffConfig.storage === 'sharepoint') {
        items = await handoffApi.getHandoffRecords(dayScope, 'all');
      } else {
        items = loadRecordsFromStorage(dayScope);
      }

      return computeHandoffSummary(items);
    },
    // 30秒間はキャッシュ有効（変更時は invalidateQueries で即無効化）
    staleTime: 30_000,
    // 60秒ごとにバックグラウンド再取得（ポーリング）
    refetchInterval: 60_000,
    // ウィンドウフォーカス時も再取得 (TQ デフォルト true)
    refetchOnWindowFocus: true,
    // 初期値: ゼロ状態を返す（ローディング中も UI が壊れない）
    placeholderData: EMPTY_SUMMARY,
  });

  // data は placeholderData により常に defined
  return data ?? EMPTY_SUMMARY;
}
