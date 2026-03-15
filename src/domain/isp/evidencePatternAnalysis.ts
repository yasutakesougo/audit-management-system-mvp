/**
 * evidencePatternAnalysis — Evidence Pattern Analysis (Phase 3-A)
 *
 * 蓄積された Evidence Links と ABC/PDCA データを横断的に集計し、
 * 支援判断に活用できるサマリーを生成する pure functions。
 *
 * 主な責務:
 *  - 戦略別の採用件数集計
 *  - よく採用される ABC / PDCA の特定
 *  - 場面別・行動別・強度別の傾向分析
 *  - 有効支援パターンの抽出
 *
 * @module domain/isp/evidencePatternAnalysis
 */

import type { EvidenceLinkMap, StrategyEvidenceKey, EvidenceLink } from './evidenceLink';
import type { AbcRecord } from '../abc/abcRecord';

// ─────────────────────────────────────────────
// Result types
// ─────────────────────────────────────────────

/** 戦略ごとの採用件数 */
export interface StrategyLinkCounts {
  antecedentStrategies: { abc: number; pdca: number; total: number };
  teachingStrategies: { abc: number; pdca: number; total: number };
  consequenceStrategies: { abc: number; pdca: number; total: number };
  /** 全戦略の合計 */
  grandTotal: { abc: number; pdca: number; total: number };
}

/** ランキング1項目 */
export interface RankedItem {
  id: string;
  label: string;
  count: number;
}

/** 場面×行動パターンのクロス集計 */
export interface SettingBehaviorPattern {
  /** 場面 */
  setting: string;
  /** 行動（短縮版） */
  behavior: string;
  /** 出現回数 */
  count: number;
  /** よく採用される戦略（最多のもの） */
  dominantStrategy: StrategyEvidenceKey | null;
  /** 戦略別の採用回数 */
  strategyBreakdown: Record<StrategyEvidenceKey, number>;
}

/** 強度分布 */
export interface IntensityDistribution {
  low: number;
  medium: number;
  high: number;
  total: number;
  riskCount: number;
  riskRate: number;
}

/** 戦略ごとの強度傾向 */
export interface StrategyIntensityProfile {
  strategy: StrategyEvidenceKey;
  strategyLabel: string;
  distribution: IntensityDistribution;
}

/** Evidence Pattern サマリー全体 */
export interface EvidencePatternSummary {
  /** 戦略別の採用件数 */
  strategyLinkCounts: StrategyLinkCounts;
  /** よく採用されるABC 上位N件 */
  topLinkedAbcRecords: RankedItem[];
  /** よく採用されるPDCA 上位N件 */
  topLinkedPdcaItems: RankedItem[];
  /** 頻出場面 上位N件 */
  topSettings: RankedItem[];
  /** 頻出行動 上位N件 */
  topBehaviors: RankedItem[];
  /** 全体の強度分布 */
  overallIntensity: IntensityDistribution;
  /** 戦略ごとの強度傾向 */
  strategyIntensityProfiles: StrategyIntensityProfile[];
  /** 場面×行動パターン 上位N件 */
  settingBehaviorPatterns: SettingBehaviorPattern[];
  /** 集計対象 ABC 件数 */
  totalAbcRecords: number;
  /** 集計対象 Evidence Links 件数 */
  totalLinks: number;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const STRATEGY_LABELS: Record<StrategyEvidenceKey, string> = {
  antecedentStrategies: '先行事象戦略',
  teachingStrategies: '教授戦略',
  consequenceStrategies: '後続事象戦略',
};

const STRATEGY_KEYS: StrategyEvidenceKey[] = [
  'antecedentStrategies',
  'teachingStrategies',
  'consequenceStrategies',
];

const DEFAULT_TOP_N = 5;
const BEHAVIOR_TRUNCATE_LEN = 20;

// ─────────────────────────────────────────────
// 1. 戦略別採用件数
// ─────────────────────────────────────────────

/**
 * 戦略セクションごとの ABC/PDCA 採用件数を集計する
 */
export function getEvidenceLinkCountsByStrategy(
  linkMap: EvidenceLinkMap,
): StrategyLinkCounts {
  function countSection(links: EvidenceLink[]): { abc: number; pdca: number; total: number } {
    const abc = links.filter(l => l.type === 'abc').length;
    const pdca = links.filter(l => l.type === 'pdca').length;
    return { abc, pdca, total: abc + pdca };
  }

  const ant = countSection(linkMap.antecedentStrategies);
  const teach = countSection(linkMap.teachingStrategies);
  const cons = countSection(linkMap.consequenceStrategies);

  return {
    antecedentStrategies: ant,
    teachingStrategies: teach,
    consequenceStrategies: cons,
    grandTotal: {
      abc: ant.abc + teach.abc + cons.abc,
      pdca: ant.pdca + teach.pdca + cons.pdca,
      total: ant.total + teach.total + cons.total,
    },
  };
}

// ─────────────────────────────────────────────
// 2. よく採用される根拠のランキング
// ─────────────────────────────────────────────

/** すべてのリンクをフラット化する内部ヘルパー */
function flattenLinks(linkMap: EvidenceLinkMap): EvidenceLink[] {
  return [
    ...linkMap.antecedentStrategies,
    ...linkMap.teachingStrategies,
    ...linkMap.consequenceStrategies,
  ];
}

/**
 * よく採用される ABC を上位N件で返す
 */
export function getTopLinkedAbcRecords(
  linkMap: EvidenceLinkMap,
  topN: number = DEFAULT_TOP_N,
): RankedItem[] {
  return rankByReferenceId(
    flattenLinks(linkMap).filter(l => l.type === 'abc'),
    topN,
  );
}

/**
 * よく採用される PDCA を上位N件で返す
 */
export function getTopLinkedPdcaItems(
  linkMap: EvidenceLinkMap,
  topN: number = DEFAULT_TOP_N,
): RankedItem[] {
  return rankByReferenceId(
    flattenLinks(linkMap).filter(l => l.type === 'pdca'),
    topN,
  );
}

/** referenceId ごとに出現回数を集計してランキング化 */
function rankByReferenceId(links: EvidenceLink[], topN: number): RankedItem[] {
  const counts = new Map<string, { label: string; count: number }>();

  for (const link of links) {
    const existing = counts.get(link.referenceId);
    if (existing) {
      existing.count++;
    } else {
      counts.set(link.referenceId, { label: link.label, count: 1 });
    }
  }

  return [...counts.entries()]
    .map(([id, { label, count }]) => ({ id, label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

// ─────────────────────────────────────────────
// 3. 場面別・行動別の傾向
// ─────────────────────────────────────────────

/**
 * ABC記録から頻出場面を集計
 */
export function getTopSettings(
  records: AbcRecord[],
  topN: number = DEFAULT_TOP_N,
): RankedItem[] {
  return countAndRank(
    records.map(r => r.setting).filter(Boolean),
    topN,
  );
}

/**
 * ABC記録から頻出行動を集計
 */
export function getTopBehaviors(
  records: AbcRecord[],
  topN: number = DEFAULT_TOP_N,
): RankedItem[] {
  return countAndRank(
    records.map(r => r.behavior.slice(0, BEHAVIOR_TRUNCATE_LEN).trim()).filter(Boolean),
    topN,
  );
}

/** 文字列配列を集計してランキング化する汎用ヘルパー */
function countAndRank(items: string[], topN: number): RankedItem[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ id: name, label: name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

// ─────────────────────────────────────────────
// 4. 強度分布
// ─────────────────────────────────────────────

/**
 * ABC記録の強度分布を集計
 */
export function getIntensityDistribution(records: AbcRecord[]): IntensityDistribution {
  const dist: IntensityDistribution = {
    low: 0, medium: 0, high: 0,
    total: records.length,
    riskCount: 0,
    riskRate: 0,
  };

  for (const r of records) {
    dist[r.intensity]++;
    if (r.riskFlag) dist.riskCount++;
  }

  dist.riskRate = records.length > 0
    ? Math.round((dist.riskCount / records.length) * 100) / 100
    : 0;

  return dist;
}

/**
 * 戦略ごとの強度傾向を集計
 *
 * 各戦略に紐づけられたABCの強度分布を返す。
 */
export function getStrategyIntensityProfiles(
  linkMap: EvidenceLinkMap,
  abcRecordsLookup: Map<string, AbcRecord>,
): StrategyIntensityProfile[] {
  return STRATEGY_KEYS.map(key => {
    const abcLinks = linkMap[key].filter(l => l.type === 'abc');
    const linkedRecords = abcLinks
      .map(l => abcRecordsLookup.get(l.referenceId))
      .filter((r): r is AbcRecord => r != null);

    return {
      strategy: key,
      strategyLabel: STRATEGY_LABELS[key],
      distribution: getIntensityDistribution(linkedRecords),
    };
  });
}

// ─────────────────────────────────────────────
// 5. 場面×行動パターン（有効支援パターン分析）
// ─────────────────────────────────────────────

/**
 * 場面×行動のクロス集計を行い、各パターンに最も多く紐づけられている戦略を特定する
 */
export function getSettingBehaviorPatterns(
  linkMap: EvidenceLinkMap,
  abcRecordsLookup: Map<string, AbcRecord>,
  topN: number = DEFAULT_TOP_N,
): SettingBehaviorPattern[] {
  // ABC link → 所属戦略のマッピングを構築
  const linkToStrategy = new Map<string, StrategyEvidenceKey[]>();
  for (const key of STRATEGY_KEYS) {
    for (const link of linkMap[key]) {
      if (link.type !== 'abc') continue;
      const existing = linkToStrategy.get(link.referenceId) ?? [];
      existing.push(key);
      linkToStrategy.set(link.referenceId, existing);
    }
  }

  // パターンを集計
  const patternKey = (setting: string, behavior: string) => `${setting}|||${behavior}`;
  const patterns = new Map<string, {
    setting: string;
    behavior: string;
    count: number;
    strategies: Record<StrategyEvidenceKey, number>;
  }>();

  for (const [refId, strategies] of linkToStrategy.entries()) {
    const record = abcRecordsLookup.get(refId);
    if (!record || !record.setting) continue;

    const behavior = record.behavior.slice(0, BEHAVIOR_TRUNCATE_LEN).trim();
    if (!behavior) continue;

    const key = patternKey(record.setting, behavior);
    const existing = patterns.get(key);

    if (existing) {
      existing.count++;
      for (const s of strategies) {
        existing.strategies[s]++;
      }
    } else {
      const strats: Record<StrategyEvidenceKey, number> = {
        antecedentStrategies: 0,
        teachingStrategies: 0,
        consequenceStrategies: 0,
      };
      for (const s of strategies) {
        strats[s]++;
      }
      patterns.set(key, {
        setting: record.setting,
        behavior,
        count: 1,
        strategies: strats,
      });
    }
  }

  return [...patterns.values()]
    .map(p => {
      // 最多戦略を特定
      let dominantStrategy: StrategyEvidenceKey | null = null;
      let maxCount = 0;
      for (const key of STRATEGY_KEYS) {
        if (p.strategies[key] > maxCount) {
          maxCount = p.strategies[key];
          dominantStrategy = key;
        }
      }

      return {
        setting: p.setting,
        behavior: p.behavior,
        count: p.count,
        dominantStrategy,
        strategyBreakdown: p.strategies,
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

// ─────────────────────────────────────────────
// 6. 統合サマリー
// ─────────────────────────────────────────────

/**
 * Evidence Pattern サマリーを一括生成する
 *
 * すべての集計関数を統合し、一度のコールで完全なサマリーを返す。
 */
export function buildEvidencePatternSummary(
  linkMap: EvidenceLinkMap,
  abcRecords: AbcRecord[],
  topN: number = DEFAULT_TOP_N,
): EvidencePatternSummary {
  const abcRecordsLookup = new Map(abcRecords.map(r => [r.id, r]));
  const allLinks = flattenLinks(linkMap);

  return {
    strategyLinkCounts: getEvidenceLinkCountsByStrategy(linkMap),
    topLinkedAbcRecords: getTopLinkedAbcRecords(linkMap, topN),
    topLinkedPdcaItems: getTopLinkedPdcaItems(linkMap, topN),
    topSettings: getTopSettings(abcRecords, topN),
    topBehaviors: getTopBehaviors(abcRecords, topN),
    overallIntensity: getIntensityDistribution(abcRecords),
    strategyIntensityProfiles: getStrategyIntensityProfiles(linkMap, abcRecordsLookup),
    settingBehaviorPatterns: getSettingBehaviorPatterns(linkMap, abcRecordsLookup, topN),
    totalAbcRecords: abcRecords.length,
    totalLinks: allLinks.length,
  };
}
