/**
 * 申し送りサマリー用フック（読み取り専用）
 *
 * 朝会・夕会システムで申し送り状況を表示するための軽量hook
 * useHandoffTimelineとは別で、統計情報のみ取得
 * Phase 8A: SharePoint API対応
 */

import { useEffect, useState } from 'react';
import { useHandoffApi } from './handoffApi';
import { handoffConfig } from './handoffConfig';
import type { HandoffCategory, HandoffDayScope, HandoffRecord, HandoffStatus } from './handoffTypes';
import { isTerminalStatus } from './handoffTypes';

const STORAGE_KEY = 'handoff.timeline.dev.v1';

type HandoffSummary = {
  total: number;
  byStatus: Record<HandoffStatus, number>;
  // 重要度ベースで何かやりたくなった時用
  criticalCount: number; // severity === '重要' && status !== '対応済'
  // カテゴリ別集計（Step 7A追加）
  byCategory: Record<HandoffCategory, number>;
};

/**
 * 日付キーを生成（YYYY-MM-DD形式）
 */
function getTodayKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * 日付スコープに応じた日付キーを取得（Step A-1: Option A対応）
 */
function getDateKeyForScope(dayScope: HandoffDayScope): string {
  const now = new Date();
  if (dayScope === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return getTodayKey(yesterday);
  }
  return getTodayKey(now);
}

type StorageShape = Record<string, HandoffRecord[]>;

/**
 * localStorage から指定日のデータを読み込み（Step A-1: dayScope対応）
 */
function loadDataFromStorage(dayScope: HandoffDayScope): HandoffRecord[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const data = JSON.parse(raw) as StorageShape;
    const dateKey = getDateKeyForScope(dayScope);
    return data[dateKey] ?? [];
  } catch {
    return [];
  }
}

/**
 * 申し送りサマリー情報を取得するフック（Phase 8A: 2モード対応）
 *
 * @param options dayScope指定可能（朝会=昨日、夕会=今日）
 */
export function useHandoffSummary(options?: { dayScope?: HandoffDayScope }): HandoffSummary {
  const dayScope = options?.dayScope ?? 'today';
  const handoffApi = useHandoffApi(); // フックでAPIインスタンスを取得

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
        let items: HandoffRecord[];

        if (handoffConfig.storage === 'sharepoint') {
          // SharePoint API モード
          items = await handoffApi.getHandoffRecords(dayScope, 'all');
        } else {
          // localStorage モード（開発用）
          items = loadDataFromStorage(dayScope);
        }

        let pending = 0;
        let inProgress = 0;
        let done = 0;
        let reviewed = 0;
        let carryOver = 0;
        let closed = 0;
        let critical = 0;

        // カテゴリ別カウンター初期化
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
          if (item.status === '未対応') pending++;
          if (item.status === '対応中') inProgress++;
          if (item.status === '対応済') done++;
          if (item.status === '確認済') reviewed++;
          if (item.status === '明日へ持越') carryOver++;
          if (item.status === '完了') closed++;

          // 重要・未完了カウント
          if (item.severity === '重要' && !isTerminalStatus(item.status)) {
            critical++;
          }

          // カテゴリ別カウント（Step 7A）
          categoryCount[item.category]++;
        }

        setSummary({
          total: items.length,
          byStatus: {
            '未対応': pending,
            '対応中': inProgress,
            '対応済': done,
            '確認済': reviewed,
            '明日へ持越': carryOver,
            '完了': closed,
          },
          criticalCount: critical,
          byCategory: categoryCount,
        });
      } catch (error) {
        console.error('[handoff] Summary load failed:', error);
        // エラー時は空のサマリーを設定
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
  }, [dayScope]);

  return summary;
}
