/**
 * 申し送りサマリー用フック（読み取り専用）
 *
 * 朝会・夕会システムで申し送り状況を表示するための軽量hook
 * useHandoffTimelineとは別で、統計情報のみ取得
 *
 * v3.0: Ports & Adapters 化 — Factory 経由でインフラ層にアクセス
 * v3.1: computeHandoffSummary を純粋関数として分離（テスト容易性向上）
 */

import { useEffect, useState } from 'react';
import { isTerminalStatus } from './handoffStateMachine';
import type { HandoffCategory, HandoffDayScope, HandoffRecord, HandoffStatus } from './handoffTypes';
import { useHandoffData } from './hooks/useHandoffData';

type HandoffSummaryResult = {
  total: number;
  byStatus: Record<HandoffStatus, number>;
  criticalCount: number;
  byCategory: Record<HandoffCategory, number>;
};

// ── 初期値ファクトリ ──

function createEmptySummary(): HandoffSummaryResult {
  return {
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
}

// ── 純粋関数: テスト可能な集計ロジック ──

/**
 * HandoffRecord 配列からサマリー統計を集計する純粋関数。
 * Reactフックに依存しないため、ユニットテストで直接呼び出し可能。
 */
export function computeHandoffSummary(items: HandoffRecord[]): HandoffSummaryResult {
  const result = createEmptySummary();

  result.total = items.length;

  for (const item of items) {
    // ステータス別カウント
    if (item.status in result.byStatus) {
      result.byStatus[item.status]++;
    }

    // 重要 × 未完了 → criticalCount
    if (item.severity === '重要' && !isTerminalStatus(item.status)) {
      result.criticalCount++;
    }

    // カテゴリ別カウント
    if (item.category in result.byCategory) {
      result.byCategory[item.category as HandoffCategory]++;
    }
  }

  return result;
}

// ── React Hook ──

/**
 * 申し送りサマリー情報を取得するフック（v3.0: Port 経由）
 *
 * @param options dayScope指定可能（朝会=昨日、夕会=今日）
 */
export function useHandoffSummary(options?: { dayScope?: HandoffDayScope }): HandoffSummaryResult {
  const dayScope = options?.dayScope ?? 'today';
  const { repo } = useHandoffData();

  const [summary, setSummary] = useState<HandoffSummaryResult>(createEmptySummary);

  useEffect(() => {
    async function loadSummary() {
      try {
        // Port 経由でデータ取得（Adapter 内部で localStorage/SP を判別）
        const items = await repo.getRecords(dayScope, 'all');
        setSummary(computeHandoffSummary(items));
      } catch (error) {
        console.error('[handoff] Summary load failed:', error);
        setSummary(createEmptySummary());
      }
    }

    loadSummary();
  }, [repo, dayScope]);

  return summary;
}
