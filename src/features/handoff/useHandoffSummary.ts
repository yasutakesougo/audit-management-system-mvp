/**
 * 申し送りサマリー用フック（読み取り専用）
 *
 * 朝会・夕会システムで申し送り状況を表示するための軽量hook
 * useHandoffTimelineとは別で、統計情報のみ取得
 *
 * v3.0: Ports & Adapters 化 — Factory 経由でインフラ層にアクセス
 */

import { useEffect, useState } from 'react';
import { isTerminalStatus } from './handoffStateMachine';
import type { HandoffCategory, HandoffDayScope, HandoffStatus } from './handoffTypes';
import { useHandoffData } from './hooks/useHandoffData';

type HandoffSummary = {
  total: number;
  byStatus: Record<HandoffStatus, number>;
  criticalCount: number;
  byCategory: Record<HandoffCategory, number>;
};

/**
 * 申し送りサマリー情報を取得するフック（v3.0: Port 経由）
 *
 * @param options dayScope指定可能（朝会=昨日、夕会=今日）
 */
export function useHandoffSummary(options?: { dayScope?: HandoffDayScope }): HandoffSummary {
  const dayScope = options?.dayScope ?? 'today';
  const { repo } = useHandoffData();

  const [summary, setSummary] = useState<HandoffSummary>({
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
  });

  useEffect(() => {
    async function loadSummary() {
      try {
        // Port 経由でデータ取得（Adapter 内部で localStorage/SP を判別）
        const items = await repo.getRecords(dayScope, 'all');

        let pending = 0;
        let inProgress = 0;
        let done = 0;
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
          if (item.status === '未対応') pending++;
          if (item.status === '対応中') inProgress++;
          if (item.status === '対応済' || item.status === '完了') done++;

          if (item.severity === '重要' && !isTerminalStatus(item.status)) {
            critical++;
          }

          if (item.category in categoryCount) {
            categoryCount[item.category as HandoffCategory]++;
          }
        }

        setSummary({
          total: items.length,
          byStatus: {
            '未対応': pending,
            '対応中': inProgress,
            '対応済': done,
            '確認済': items.filter(i => i.status === '確認済').length,
            '明日へ持越': items.filter(i => i.status === '明日へ持越').length,
            '完了': items.filter(i => i.status === '完了').length,
          },
          criticalCount: critical,
          byCategory: categoryCount,
        });
      } catch (error) {
        console.error('[handoff] Summary load failed:', error);
        setSummary({
          total: 0,
          byStatus: { '未対応': 0, '対応中': 0, '対応済': 0, '確認済': 0, '明日へ持越': 0, '完了': 0 },
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
        });
      }
    }

    loadSummary();
  }, [repo, dayScope]);

  return summary;
}
