/**
 * @fileoverview Phase F2 + F2.5: タグトレンド検知 — pure domain functions
 * @description
 * 2つの期間（current / baseline）のタグ頻度を比較し、
 * 急増(spike)・消失(drop)・新規出現(new) を検知する。
 *
 * F2.5: ノイズ制御 — maxAlerts / maxPerType / minNewCount で
 * アラートの「出すぎ問題」を domain レベルで抑制する。
 *
 * 閾値はデフォルトで提供し、呼び出し側で上書き可能。
 *
 * @see features/tag-analytics/domain/tagAnalytics.ts
 */

import { BEHAVIOR_TAGS, type BehaviorTagKey, BEHAVIOR_TAG_CATEGORIES, type BehaviorTagCategory } from '@/features/daily/domain/behaviorTag';
import type { TagCount } from './tagAnalytics';

// ─── 型定義 ──────────────────────────────────────────────

/** トレンドアラートの種類 */
export type TrendAlertType = 'spike' | 'drop' | 'new';

/** トレンドアラートの重要度 */
export type TrendAlertSeverity = 'warning' | 'info';

/** 個別のトレンドアラート */
export type TrendAlert = {
  /** アラート種類 */
  type: TrendAlertType;
  /** 重要度 */
  severity: TrendAlertSeverity;
  /** タグキー */
  tagKey: string;
  /** タグ表示ラベル */
  tagLabel: string;
  /** タグカテゴリ */
  category: string;
  /** カテゴリ表示ラベル */
  categoryLabel: string;
  /** 現在期間のカウント */
  currentCount: number;
  /** ベースライン期間のカウント */
  baselineCount: number;
  /** 変化率（%）: spike/drop の場合。new の場合は Infinity */
  changeRate: number;
  /** 人間が読めるメッセージ */
  message: string;
};

/** detectTagTrends の入力 */
export type DetectTagTrendsInput = {
  /** 現在期間のタグカウント（例: 7日） */
  currentCounts: TagCount;
  /** ベースライン期間のタグカウント（例: 30日） */
  baselineCounts: TagCount;
  /** 現在期間の日数 */
  currentDays: number;
  /** ベースライン期間の日数 */
  baselineDays: number;
};

/** detectTagTrends の閾値設定 */
export type TrendThresholds = {
  /** 日次平均が baseline の何倍以上で spike とするか（default: 2.0） */
  spikeMultiplier: number;
  /** baseline に存在するが current に0件なら drop（default: true） */
  detectDrops: boolean;
  /** current にのみ存在するタグを new とするか（default: true） */
  detectNew: boolean;
  /** spike/drop の最低カウント（ノイズ除去）（default: 2） */
  minCount: number;
  // ── F2.5: ノイズ制御 ──
  /** new タグの最低カウント（default: 2、1回だけの new はノイズ） */
  minNewCount: number;
  /** 全アラート合計の最大件数（default: 5） */
  maxAlerts: number;
  /** 種類別の最大件数（default: 3、spike/drop/new それぞれ最大3件） */
  maxPerType: number;
};

/** detectTagTrends の出力 */
export type TagTrendAlerts = {
  /** 急増タグ */
  spikes: TrendAlert[];
  /** 消失タグ */
  drops: TrendAlert[];
  /** 新規出現タグ */
  newTags: TrendAlert[];
  /** 全アラート（severity 順: warning → info、changeRate 降順） */
  all: TrendAlert[];
  /** アラートが1つ以上あるか */
  hasAlerts: boolean;
  /** F2.5: ノイズ制御で切り捨てられた件数 */
  truncatedCount: number;
};

// ─── 定数 ────────────────────────────────────────────────

export const DEFAULT_THRESHOLDS: TrendThresholds = {
  spikeMultiplier: 2.0,
  detectDrops: true,
  detectNew: true,
  minCount: 2,
  minNewCount: 2,
  maxAlerts: 5,
  maxPerType: 3,
};

// ─── メインロジック ──────────────────────────────────────

/**
 * 2つの期間のタグ頻度を比較し、トレンドアラートを検知する。
 *
 * アルゴリズム:
 * 1. 日次平均を算出（count / days）
 * 2. current の日次平均が baseline の日次平均 × spikeMultiplier 以上 → spike
 * 3. baseline に存在するが current に 0 件 → drop
 * 4. current にのみ存在 → new
 *
 * @param input 現在期間とベースライン期間のタグカウント+日数
 * @param thresholds 検知閾値（部分指定可能）
 */
export function detectTagTrends(
  input: DetectTagTrendsInput,
  thresholds?: Partial<TrendThresholds>,
): TagTrendAlerts {
  const config: TrendThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const { currentCounts, baselineCounts, currentDays, baselineDays } = input;

  const spikes: TrendAlert[] = [];
  const drops: TrendAlert[] = [];
  const newTags: TrendAlert[] = [];

  const allKeys = new Set([
    ...Object.keys(currentCounts),
    ...Object.keys(baselineCounts),
  ]);

  for (const key of allKeys) {
    const cur = currentCounts[key] ?? 0;
    const base = baselineCounts[key] ?? 0;
    const tagInfo = resolveTagInfo(key);

    // ── 新規出現 ──
    if (config.detectNew && cur >= config.minNewCount && base === 0) {
      newTags.push({
        type: 'new',
        severity: 'info',
        tagKey: key,
        tagLabel: tagInfo.label,
        category: tagInfo.category,
        categoryLabel: tagInfo.categoryLabel,
        currentCount: cur,
        baselineCount: 0,
        changeRate: Infinity,
        message: `新規出現: ${tagInfo.label}（${cur}回）`,
      });
      continue;
    }

    // ── 消失 ──
    if (config.detectDrops && cur === 0 && base >= config.minCount) {
      drops.push({
        type: 'drop',
        severity: 'info',
        tagKey: key,
        tagLabel: tagInfo.label,
        category: tagInfo.category,
        categoryLabel: tagInfo.categoryLabel,
        currentCount: 0,
        baselineCount: base,
        changeRate: -100,
        message: `消失: ${tagInfo.label}（直近0件、前期間${base}回）`,
      });
      continue;
    }

    // ── 急増 ──
    if (cur >= config.minCount && base >= 1) {
      const curDailyAvg = cur / Math.max(1, currentDays);
      const baseDailyAvg = base / Math.max(1, baselineDays);

      if (baseDailyAvg > 0 && curDailyAvg >= baseDailyAvg * config.spikeMultiplier) {
        const changeRate = Math.round(((curDailyAvg - baseDailyAvg) / baseDailyAvg) * 100);
        spikes.push({
          type: 'spike',
          severity: 'warning',
          tagKey: key,
          tagLabel: tagInfo.label,
          category: tagInfo.category,
          categoryLabel: tagInfo.categoryLabel,
          currentCount: cur,
          baselineCount: base,
          changeRate,
          message: `急増: ${tagInfo.label}（+${changeRate}%）`,
        });
      }
    }
  }

  // ソート: changeRate 降順（spike）、baselineCount 降順（drop）、currentCount 降順（new）
  spikes.sort((a, b) => b.changeRate - a.changeRate);
  drops.sort((a, b) => b.baselineCount - a.baselineCount);
  newTags.sort((a, b) => b.currentCount - a.currentCount);

  // F2.5: 種類別の上限カット（ソート後に slice）
  const trimmedSpikes = spikes.slice(0, config.maxPerType);
  const trimmedDrops = drops.slice(0, config.maxPerType);
  const trimmedNewTags = newTags.slice(0, config.maxPerType);

  // 全アラート統合: warning → info、その中で changeRate 降順
  const allUntrimmed = [...trimmedSpikes, ...trimmedDrops, ...trimmedNewTags].sort((a, b) => {
    const severityOrder = a.severity === b.severity ? 0 : a.severity === 'warning' ? -1 : 1;
    if (severityOrder !== 0) return severityOrder;
    // Infinity の比較を安全にする
    const aRate = Number.isFinite(a.changeRate) ? a.changeRate : 999;
    const bRate = Number.isFinite(b.changeRate) ? b.changeRate : 999;
    return bRate - aRate;
  });

  // F2.5: 全体の上限カット
  const all = allUntrimmed.slice(0, config.maxAlerts);
  const totalRaw = spikes.length + drops.length + newTags.length;
  const truncatedCount = totalRaw - all.length;

  return {
    spikes: trimmedSpikes,
    drops: trimmedDrops,
    newTags: trimmedNewTags,
    all,
    hasAlerts: all.length > 0,
    truncatedCount: Math.max(0, truncatedCount),
  };
}

// ─── ヘルパー ────────────────────────────────────────────

function resolveTagInfo(key: string): {
  label: string;
  category: string;
  categoryLabel: string;
} {
  const def = BEHAVIOR_TAGS[key as BehaviorTagKey];
  return {
    label: def?.label ?? key,
    category: def?.category ?? 'unknown',
    categoryLabel: BEHAVIOR_TAG_CATEGORIES[def?.category as BehaviorTagCategory] ?? '不明',
  };
}
