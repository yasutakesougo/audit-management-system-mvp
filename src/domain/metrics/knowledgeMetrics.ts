/**
 * @fileoverview Knowledge Metrics — 組織知化の蓄積度を定量化
 * @description
 * 判断記録・Evidence Link・パターン再利用を集計し、
 * 組織の知識が蓄積されているかを測る Pure Function 群。
 *
 * 原則:
 * - pure function のみ（副作用なし）
 * - ゼロ除算安全
 * - UI / storage 依存ゼロ
 *
 * @see docs/ops/metrics-framework.md § Knowledge Metrics
 * @see docs/data/knowledge-model.md
 */

import type { ProposalSource } from '@/features/handoff/analysis/proposalBundle';

import { safeRate } from './proposalMetrics';
import { KNOWLEDGE_GROWTH } from './metricsThresholds';

// ─── 入力型 ──────────────────────────────────────────────

/** Evidence Link の記録 */
export interface EvidenceLinkRecord {
  /** 紐づく支援計画 ID */
  planningSheetId: string;
  /** リンク種別 */
  linkType: 'abc' | 'pdca';
  /** リンク先 ID */
  targetId: string;
}

/** 判断記録（採用/却下） */
export interface DecisionRecord {
  /** 記録 ID */
  id: string;
  /** ソース */
  source: ProposalSource;
  /** 判断 */
  action: 'accepted' | 'dismissed';
  /** 却下理由（dismissed 時、undefined = 理由なし） */
  dismissReason?: string;
  /** ルール ID prefix（パターン判定用） */
  rulePrefix: string;
  /** 判断日 ISO 8601 */
  decidedAt: string;
}

/** 集計期間 */
export interface KnowledgePeriod {
  start: string;
  end: string;
  /** 期間の月数（日割りではなく月単位の集計用） */
  months: number;
}

// ─── 出力型 ──────────────────────────────────────────────

/** パターン再利用の情報 */
export interface PatternReuseInfo {
  /** ルール prefix */
  rulePrefix: string;
  /** 出現回数 */
  totalOccurrences: number;
  /** 採用回数 */
  acceptedCount: number;
  /** 採用率 */
  acceptanceRate: number;
}

/** ソース別判断分布 */
export interface SourceDistribution {
  source: ProposalSource;
  count: number;
  rate: number;
}

/** 全体集計結果 */
export interface KnowledgeMetricsResult {
  /** 判断記録総数 */
  totalDecisions: number;
  /** 月あたりの判断記録数 */
  decisionsPerMonth: number;
  /** 理由付き却下率 (0-100) */
  reasonedDismissRate: number;
  /** 理由なし却下数 */
  unreasonedDismissCount: number;
  /** Evidence Link 総数 */
  totalLinks: number;
  /** 支援計画あたりの平均 Evidence Link 数 */
  avgLinksPerSheet: number;
  /** Evidence Link がある支援計画の割合 */
  linkedSheetRate: number;
  /** ソース別判断分布 */
  sourceDistribution: SourceDistribution[];
  /** パターン再利用ランキング（採用回数降順、上位 10） */
  topPatterns: PatternReuseInfo[];
  /** ユニークなルール prefix 数 */
  uniquePatternCount: number;
  /** 成功パターン数（採用率 60% 以上かつ出現 3 回以上） */
  provenPatternCount: number;
}

// ─── メイン集計関数 ──────────────────────────────────────

/**
 * Knowledge Metrics を計算する。
 *
 * @param decisions        - 判断記録
 * @param evidenceLinks    - Evidence Link 記録
 * @param planningSheetIds - 全支援計画 ID（リンク率の分母）
 * @param period           - 集計期間
 */
export function computeKnowledgeMetrics(
  decisions: DecisionRecord[],
  evidenceLinks: EvidenceLinkRecord[],
  planningSheetIds: string[],
  period: KnowledgePeriod,
): KnowledgeMetricsResult {
  const totalDecisions = decisions.length;
  const months = Math.max(period.months, 1); // 0 除算防止

  // 理由付き却下率
  const dismissed = decisions.filter(d => d.action === 'dismissed');
  const reasonedDismiss = dismissed.filter(d => d.dismissReason && d.dismissReason !== '');
  const unreasonedDismissCount = dismissed.length - reasonedDismiss.length;

  // Evidence Link
  const totalLinks = evidenceLinks.length;
  const sheetsWithLinks = new Set(evidenceLinks.map(l => l.planningSheetId));
  const totalSheets = planningSheetIds.length;

  // ソース別
  const sourceDistribution = computeSourceDistribution(decisions);

  // パターン再利用
  const { topPatterns, uniquePatternCount, provenPatternCount } =
    computePatternReuse(decisions);

  return {
    totalDecisions,
    decisionsPerMonth: totalDecisions > 0
      ? Math.round((totalDecisions / months) * 10) / 10
      : 0,
    reasonedDismissRate: safeRate(reasonedDismiss.length, dismissed.length),
    unreasonedDismissCount,
    totalLinks,
    avgLinksPerSheet: totalSheets > 0
      ? Math.round((totalLinks / totalSheets) * 10) / 10
      : 0,
    linkedSheetRate: safeRate(sheetsWithLinks.size, totalSheets),
    sourceDistribution,
    topPatterns,
    uniquePatternCount,
    provenPatternCount,
  };
}

// ─── ソース別分布 ────────────────────────────────────────

function computeSourceDistribution(decisions: DecisionRecord[]): SourceDistribution[] {
  const sources: ProposalSource[] = ['handoff', 'abc', 'monitoring'];
  const total = decisions.length;

  return sources.map(source => {
    const count = decisions.filter(d => d.source === source).length;
    return {
      source,
      count,
      rate: safeRate(count, total),
    };
  });
}

// ─── パターン再利用 ──────────────────────────────────────

function computePatternReuse(decisions: DecisionRecord[]): {
  topPatterns: PatternReuseInfo[];
  uniquePatternCount: number;
  provenPatternCount: number;
} {
  const groups = new Map<string, { total: number; accepted: number }>();

  for (const d of decisions) {
    const current = groups.get(d.rulePrefix) ?? { total: 0, accepted: 0 };
    current.total++;
    if (d.action === 'accepted') current.accepted++;
    groups.set(d.rulePrefix, current);
  }

  const allPatterns: PatternReuseInfo[] = Array.from(groups.entries())
    .map(([rulePrefix, counts]) => ({
      rulePrefix,
      totalOccurrences: counts.total,
      acceptedCount: counts.accepted,
      acceptanceRate: safeRate(counts.accepted, counts.total),
    }));

  // 成功パターン: 採用率 ≥ PROVEN_ACCEPTANCE_RATE かつ出現 ≥ PROVEN_MIN_OCCURRENCES
  const provenPatternCount = allPatterns.filter(
    p => p.acceptanceRate >= KNOWLEDGE_GROWTH.PROVEN_ACCEPTANCE_RATE && p.totalOccurrences >= KNOWLEDGE_GROWTH.PROVEN_MIN_OCCURRENCES,
  ).length;

  // 上位 10 パターン（採用回数降順）
  const topPatterns = [...allPatterns]
    .sort((a, b) => b.acceptedCount - a.acceptedCount)
    .slice(0, 10);

  return {
    topPatterns,
    uniquePatternCount: groups.size,
    provenPatternCount,
  };
}
