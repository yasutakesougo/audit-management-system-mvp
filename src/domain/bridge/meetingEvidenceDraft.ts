/**
 * meetingEvidenceDraft — モニタリング会議ドラフト自動引用の純関数
 *
 * 複数データソース（日次記録サマリー・Today アラート・ABC 記録パターン）から
 * モニタリング会議用の構造化テキストを生成する。
 *
 * ── 設計方針 ──
 * 1. 純関数 — UI・Repository に依存しない
 * 2. 各ソースが部分的に欠けても動く（段階的引用）
 * 3. 出力は構造化テキスト（セクション別 + 結合済み）
 * 4. 会議の「総合所見」「検討事項」に直接引用できる粒度
 *
 * @module domain/bridge/meetingEvidenceDraft
 */

import type { DailyMonitoringSummary } from '@/features/monitoring/domain/monitoringDailyAnalytics';
import type { UserAlert } from '@/features/today/domain/buildUserAlerts';
import type { ABCRecord, StrategyCategory } from '@/domain/behavior/abc';

// ─────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────

/** 引用ソースの種別 */
export type EvidenceSource = 'daily' | 'alert' | 'abc' | 'strategy';

/** セクション単位の引用データ */
export interface MeetingEvidenceSection {
  /** セクションタイトル */
  title: string;
  /** 本文テキスト */
  content: string;
  /** データソース種別 */
  source: EvidenceSource;
  /** 注意レベル */
  severity: 'warning' | 'info' | 'neutral';
}

/** ドラフト全体 */
export interface MeetingEvidenceDraft {
  /** セクション別テキスト */
  sections: MeetingEvidenceSection[];
  /** 全体テキスト（結合済み、コピーペースト用） */
  fullText: string;
  /** データソース数（引用元の豊富さ） */
  sourceCount: number;
}

/** ABC 記録パターンの集計結果 */
export interface ABCPatternSummary {
  /** 先行事象の頻度 Top */
  topAntecedents: Array<{ label: string; count: number }>;
  /** 結果事象の頻度 Top */
  topConsequences: Array<{ label: string; count: number }>;
  /** 推定機能の分布 */
  functionDistribution: Array<{ fn: string; count: number }>;
  /** 集計対象レコード数 */
  totalRecords: number;
}

/** 戦略実績の集計結果 */
export interface StrategyUsageSummary {
  /** カテゴリ別の実施回数 */
  byCategory: Array<{
    category: StrategyCategory;
    categoryLabel: string;
    count: number;
  }>;
  /** 最頻出の戦略（実施済み） */
  topStrategies: Array<{ text: string; count: number }>;
  /** 総戦略参照数 */
  totalReferenced: number;
  /** 実施率 (0–1) */
  applicationRate: number;
}

/** ドラフト生成のインプット */
export interface MeetingEvidenceInput {
  /** 利用者名 */
  userName: string;
  /** 集計期間の開始日 */
  from: string;
  /** 集計期間の終了日 */
  to: string;
  /** 日次記録サマリー（既存の MonitoringDailyAnalytics） */
  dailySummary: DailyMonitoringSummary | null;
  /** Today のアラート（高強度行動・実施中戦略） */
  alerts: UserAlert[];
  /** ABC 記録の行動パターン集計 */
  abcPatterns: ABCPatternSummary | null;
  /** 戦略実績の集計 */
  strategyUsage: StrategyUsageSummary | null;
}

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<StrategyCategory, string> = {
  antecedent: '事前対応',
  teaching: '代替行動指導',
  consequence: '結果対応',
};

const FUNCTION_LABELS: Record<string, string> = {
  demand: '要求',
  escape: '回避',
  attention: '注目',
  sensory: '感覚',
};

// ─────────────────────────────────────────────────────────
// ABC パターン集計（純関数）
// ─────────────────────────────────────────────────────────

/**
 * ABCRecord[] から行動パターンを集計する。
 * 会議引用用のサマリーを生成。
 *
 * @param records - 対象期間の ABC レコード
 * @param maxItems - 各カテゴリの上位件数（デフォルト: 3）
 */
export function summarizeABCPatterns(
  records: ReadonlyArray<ABCRecord>,
  maxItems = 3,
): ABCPatternSummary | null {
  if (records.length === 0) return null;

  // 先行事象の頻度
  const antecedentCounts = new Map<string, number>();
  for (const r of records) {
    const key = r.antecedent.trim();
    if (key) antecedentCounts.set(key, (antecedentCounts.get(key) ?? 0) + 1);
  }
  const topAntecedents = [...antecedentCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxItems)
    .map(([label, count]) => ({ label, count }));

  // 結果事象の頻度
  const consequenceCounts = new Map<string, number>();
  for (const r of records) {
    const key = r.consequence.trim();
    if (key) consequenceCounts.set(key, (consequenceCounts.get(key) ?? 0) + 1);
  }
  const topConsequences = [...consequenceCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxItems)
    .map(([label, count]) => ({ label, count }));

  // 推定機能の分布
  const fnCounts = new Map<string, number>();
  for (const r of records) {
    if (r.estimatedFunction) {
      fnCounts.set(r.estimatedFunction, (fnCounts.get(r.estimatedFunction) ?? 0) + 1);
    }
  }
  const functionDistribution = [...fnCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([fn, count]) => ({ fn, count }));

  return {
    topAntecedents,
    topConsequences,
    functionDistribution,
    totalRecords: records.length,
  };
}

/**
 * ABCRecord[] から戦略使用実績を集計する。
 *
 * @param records - 対象期間の ABC レコード
 * @param maxItems - 上位戦略の件数（デフォルト: 5）
 */
export function summarizeStrategyUsage(
  records: ReadonlyArray<ABCRecord>,
  maxItems = 5,
): StrategyUsageSummary | null {
  let totalReferenced = 0;
  let totalApplied = 0;
  const categoryCounts = new Map<StrategyCategory, number>();
  const strategyCounts = new Map<string, number>();

  for (const r of records) {
    if (!r.referencedStrategies) continue;
    for (const s of r.referencedStrategies) {
      totalReferenced++;
      if (s.applied) {
        totalApplied++;
        categoryCounts.set(s.strategyKey, (categoryCounts.get(s.strategyKey) ?? 0) + 1);
        strategyCounts.set(s.strategyText, (strategyCounts.get(s.strategyText) ?? 0) + 1);
      }
    }
  }

  if (totalReferenced === 0) return null;

  const byCategory = ([
    'antecedent',
    'teaching',
    'consequence',
  ] as StrategyCategory[]).map((cat) => ({
    category: cat,
    categoryLabel: CATEGORY_LABELS[cat],
    count: categoryCounts.get(cat) ?? 0,
  }));

  const topStrategies = [...strategyCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxItems)
    .map(([text, count]) => ({ text, count }));

  return {
    byCategory,
    topStrategies,
    totalReferenced,
    applicationRate: totalReferenced > 0 ? totalApplied / totalReferenced : 0,
  };
}

// ─────────────────────────────────────────────────────────
// セクション生成（内部関数）
// ─────────────────────────────────────────────────────────

function buildDailySection(
  summary: DailyMonitoringSummary,
  from: string,
  to: string,
): MeetingEvidenceSection {
  const lines: string[] = [];

  // 期間・記録率
  lines.push(
    `集計期間: ${from} 〜 ${to}（${summary.period.recordedDays}日分 / ${summary.period.totalDays}日中）`,
  );
  lines.push(`記録率: ${summary.period.recordRate}%`);

  // 問題行動
  const bh = summary.behavior;
  if (bh.totalDays > 0) {
    const types = bh.byType.map((b) => `${b.label} ${b.count}件`).join('・');
    const trendLabel =
      bh.recentChange === 'up' ? '増加傾向' :
      bh.recentChange === 'down' ? '減少傾向' :
      '横ばい';
    lines.push(
      `問題行動: ${bh.totalDays}日で発生（発生率 ${bh.rate}%）/ ${types} / ${trendLabel}`,
    );
  } else {
    lines.push('問題行動: 記録なし');
  }

  // 昼食
  const lu = summary.lunch;
  if (lu.totalWithData > 0) {
    const stability =
      lu.stableScore >= 70 ? '安定' :
      lu.stableScore >= 40 ? 'やや不安定' :
      '不安定';
    lines.push(`昼食摂取: 安定度 ${lu.stableScore}%（${stability}）`);
  }

  return {
    title: '■ 日次記録サマリー',
    content: lines.join('\n'),
    source: 'daily',
    severity: bh.recentChange === 'up' ? 'warning' : 'neutral',
  };
}

function buildAlertSection(
  alerts: UserAlert[],
): MeetingEvidenceSection {
  const lines: string[] = [];

  const warningAlerts = alerts.filter((a) => a.severity === 'warning');
  const infoAlerts = alerts.filter((a) => a.severity !== 'warning');

  if (warningAlerts.length > 0) {
    lines.push(`注意事項: ${warningAlerts.map((a) => a.label).join('、')}`);
  }
  if (infoAlerts.length > 0) {
    lines.push(`状況: ${infoAlerts.map((a) => a.label).join('、')}`);
  }

  const hasWarning = warningAlerts.length > 0;

  return {
    title: '■ 直近アラート',
    content: lines.join('\n'),
    source: 'alert',
    severity: hasWarning ? 'warning' : 'info',
  };
}

function buildABCPatternSection(
  patterns: ABCPatternSummary,
): MeetingEvidenceSection {
  const lines: string[] = [];

  lines.push(`行動記録: ${patterns.totalRecords}件`);

  if (patterns.topAntecedents.length > 0) {
    const items = patterns.topAntecedents
      .map((a) => `${a.label}(${a.count}回)`)
      .join('・');
    lines.push(`主な先行事象: ${items}`);
  }

  if (patterns.topConsequences.length > 0) {
    const items = patterns.topConsequences
      .map((c) => `${c.label}(${c.count}回)`)
      .join('・');
    lines.push(`主な結果事象: ${items}`);
  }

  if (patterns.functionDistribution.length > 0) {
    const items = patterns.functionDistribution
      .map((f) => `${FUNCTION_LABELS[f.fn] ?? f.fn}(${f.count}件)`)
      .join('・');
    lines.push(`推定行動機能: ${items}`);
  }

  return {
    title: '■ 行動パターン分析',
    content: lines.join('\n'),
    source: 'abc',
    severity: 'neutral',
  };
}

function buildStrategySection(
  usage: StrategyUsageSummary,
): MeetingEvidenceSection {
  const lines: string[] = [];

  const ratePercent = Math.round(usage.applicationRate * 100);
  lines.push(`戦略参照: ${usage.totalReferenced}件 / 実施率: ${ratePercent}%`);

  // カテゴリ別
  const catItems = usage.byCategory
    .filter((c) => c.count > 0)
    .map((c) => `${c.categoryLabel} ${c.count}件`)
    .join('・');
  if (catItems) {
    lines.push(`カテゴリ別: ${catItems}`);
  }

  // 最頻出戦略
  if (usage.topStrategies.length > 0) {
    lines.push('よく実施された戦略:');
    for (const s of usage.topStrategies.slice(0, 3)) {
      const shortText = s.text.length > 30 ? s.text.slice(0, 29) + '…' : s.text;
      lines.push(`  - ${shortText}（${s.count}回）`);
    }
  }

  return {
    title: '■ 戦略実施実績',
    content: lines.join('\n'),
    source: 'strategy',
    severity: usage.applicationRate < 0.5 ? 'warning' : 'info',
  };
}

// ─────────────────────────────────────────────────────────
// メイン関数
// ─────────────────────────────────────────────────────────

/**
 * 複数データソースからモニタリング会議用のドラフトテキストを生成する。
 *
 * 各ソースが null / 空の場合は該当セクションをスキップする。
 * 全ソースが空の場合は sourceCount: 0 のドラフトを返す。
 */
export function buildMeetingEvidenceDraft(
  input: MeetingEvidenceInput,
): MeetingEvidenceDraft {
  const sections: MeetingEvidenceSection[] = [];

  // 1. 日次記録サマリー
  if (input.dailySummary) {
    sections.push(
      buildDailySection(input.dailySummary, input.from, input.to),
    );
  }

  // 2. アラート
  if (input.alerts.length > 0) {
    sections.push(buildAlertSection(input.alerts));
  }

  // 3. ABC パターン
  if (input.abcPatterns) {
    sections.push(buildABCPatternSection(input.abcPatterns));
  }

  // 4. 戦略実績
  if (input.strategyUsage) {
    sections.push(buildStrategySection(input.strategyUsage));
  }

  // 全体テキスト
  const headerLine = `【会議資料ドラフト】${input.userName}（${input.from} 〜 ${input.to}）`;
  const fullText = sections.length > 0
    ? [headerLine, '', ...sections.map((s) => `${s.title}\n${s.content}`)]
        .join('\n\n')
    : '';

  return {
    sections,
    fullText,
    sourceCount: sections.length,
  };
}
