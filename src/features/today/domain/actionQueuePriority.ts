/**
 * @fileoverview ActionQueue 優先度制御ロジック（純粋関数）
 * @description
 * MVP-011: Today の ActionQueue に「優先度スコアリング・並び順制御・
 * 優先理由ラベル」を追加する。
 *
 * 設計方針:
 * - todayEngine.ts の既存設計（TASK_PRIORITY）を拡張するが、変更はしない
 * - 新しい複合スコアリングをこのファイルに閉じ込める
 * - QueueCategory 単位 (ActionQueueCard) のソートに適用する
 */

import type { TodayTask, TodayTaskSource } from '@/domain/todayEngine';

// ─── 型定義 ──────────────────────────────────────────────────────

export type PriorityFactor =
  | 'critical-handoff'        // 重要申し送りが未対応
  | 'missing-record'          // 当日の記録が未入力
  | 'missing-plan'            // ISP が未作成
  | 'overdue'                 // 期限超過
  | 'high-intensity-support'  // 強度行動障害対象者
  | 'default';                // 特記なし

export type ScoredTask = TodayTask & {
  /** 複合優先度スコア (高いほど先頭) */
  compositeScore: number;
  /** このタスクが上位表示される理由ラベル（1〜2語） */
  priorityReasonLabel: string;
  /** スコアに寄与したファクター一覧 */
  factors: PriorityFactor[];
};

// ─── 定数 ─────────────────────────────────────────────────────────

/**
 * 各ファクターに加算するボーナス点
 * source の TASK_PRIORITY (40〜100) を基底として加算する
 */
const FACTOR_BONUS: Record<PriorityFactor, number> = {
  'critical-handoff': 50,
  'missing-record': 40,
  'missing-plan': 20,
  'overdue': 30,
  'high-intensity-support': 25,
  'default': 0,
};

/** ファクターの人間向けラベル（優先度高い順に採用） */
const FACTOR_LABELS: Record<PriorityFactor, string> = {
  'critical-handoff': '🔴 重要申し送り',
  'overdue': '⏰ 期限超過',
  'high-intensity-support': '🟠 強度行動障害',
  'missing-record': '📝 記録未入力',
  'missing-plan': '📋 計画未作成',
  'default': '',
};

/** ラベル表示の優先順 */
const FACTOR_DISPLAY_ORDER: PriorityFactor[] = [
  'critical-handoff',
  'overdue',
  'high-intensity-support',
  'missing-record',
  'missing-plan',
  'default',
];

// ─── 純粋関数 ────────────────────────────────────────────────────

/**
 * 単一タスクの複合優先度スコアを計算する
 *
 * @param task - 基本情報を含む TodayTask
 * @param factors - そのタスクに関連する PriorityFactor の配列
 * @returns 複合スコア (base priority + ファクターボーナスの合計)
 */
export function scoreActionQueueItem(
  task: TodayTask,
  factors: PriorityFactor[],
): number {
  const bonuses = factors.reduce((sum, f) => sum + (FACTOR_BONUS[f] ?? 0), 0);
  return task.priority + bonuses;
}

/**
 * タスクに最も重要なファクターを1つ選んで優先理由ラベルを生成する
 *
 * @param factors - PriorityFactor の配列 (複数可)
 * @returns 表示用の短いラベル文字列
 */
export function buildPriorityReasonLabel(factors: PriorityFactor[]): string {
  const topFactor = FACTOR_DISPLAY_ORDER.find((f) => factors.includes(f));
  if (!topFactor || topFactor === 'default') return '';
  return FACTOR_LABELS[topFactor] ?? '';
}

/**
 * タスクリストを複合スコアと dueTime で並び替えた ScoredTask[] を返す
 *
 * @param tasks - TodayTask の配列
 * @param getFactors - userId ごとのファクターを返す関数
 * @returns スコア付きでソートされたタスク配列
 */
export function sortActionQueueItems(
  tasks: TodayTask[],
  getFactors: (task: TodayTask) => PriorityFactor[],
): ScoredTask[] {
  const scored: ScoredTask[] = tasks.map((task) => {
    const factors = getFactors(task);
    const compositeScore = scoreActionQueueItem(task, factors);
    const priorityReasonLabel = buildPriorityReasonLabel(factors);
    return { ...task, compositeScore, priorityReasonLabel, factors };
  });

  return scored.sort((a, b) => {
    // 1. compositeScore 降順 (高い = 優先)
    if (a.compositeScore !== b.compositeScore) return b.compositeScore - a.compositeScore;
    // 2. dueTime 昇順 (早い = 優先)
    if (a.dueTime && b.dueTime) return a.dueTime.localeCompare(b.dueTime);
    if (a.dueTime) return -1;
    if (b.dueTime) return 1;
    return 0;
  });
}

// ─── カテゴリ集計への適用 ────────────────────────────────────────

export type ScoredQueueCategory = {
  key: TodayTaskSource | 'other';
  label: string;
  icon: string;
  count: number;
  color: 'error' | 'warning' | 'info';
  href: string;
  topReasonLabel: string;  // そのカテゴリで最も緊急なタスクの理由
};

/**
 * ScoredTask[] から今日のキューカテゴリを構築する
 * (ActionQueueCard.buildQueueCategories の優先度制御版)
 */
export function buildScoredQueueCategories(
  tasks: ScoredTask[],
): ScoredQueueCategory[] {
  const incomplete = tasks.filter((t) => !t.completed);

  const topReason = (source: TodayTaskSource | 'other'): string => {
    const group = incomplete.filter((t) =>
      source === 'other'
        ? t.source !== 'unrecorded' && t.source !== 'handoff'
        : t.source === source,
    );
    // compositeScore が最大のタスクの理由ラベルを採用
    const top = group.sort((a, b) => b.compositeScore - a.compositeScore)[0];
    return top?.priorityReasonLabel ?? '';
  };

  const unrecordedGroup = incomplete.filter((t) => t.source === 'unrecorded');
  const handoffGroup = incomplete.filter((t) => t.source === 'handoff');
  const otherGroup = incomplete.filter(
    (t) => t.source !== 'unrecorded' && t.source !== 'handoff',
  );

  return [
    {
      key: 'unrecorded',
      label: '未入力記録',
      icon: '📝',
      count: unrecordedGroup.length,
      color: unrecordedGroup.length > 0 ? 'error' : 'info',
      href: '/dailysupport',
      topReasonLabel: topReason('unrecorded'),
    },
    {
      key: 'handoff',
      label: '未確認申し送り',
      icon: '📨',
      count: handoffGroup.length,
      color: handoffGroup.length > 0 ? 'warning' : 'info',
      href: '/handoff-timeline',
      topReasonLabel: topReason('handoff'),
    },
    {
      key: 'other',
      label: '未完了タスク',
      icon: '📋',
      count: otherGroup.length,
      color: otherGroup.length > 0 ? 'warning' : 'info',
      href: '/today',
      topReasonLabel: topReason('other'),
    },
  ];
}
