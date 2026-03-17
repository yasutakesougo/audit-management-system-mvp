/**
 * suggestedGoals — 目標候補の自動生成（ルールベース MVP）
 *
 * P3-A: 既存データ（アセスメント / Iceberg分析 / モニタリング / 既存goals）
 * から、支援計画の目標候補を **説明可能な形** で返す。
 *
 * 設計原則:
 *  - 純粋関数のみ（React 非依存）
 *  - AI / LLM 非依存（ルールベース + キーワードマッチ）
 *  - provenance（根拠の出典）を必ず付与
 *  - 既存 goals との重複を自動除外
 */

import type { GoalItem } from '@/features/shared/goal/goalTypes';

// ────────────────────────────────────────────
// 出力型
// ────────────────────────────────────────────

export type GoalPriority = 'high' | 'medium' | 'low';

/** 目標候補1件 */
export type GoalSuggestion = {
  /** 一意識別子 */
  id: string;
  /** 提案タイトル（短い自然言語） */
  title: string;
  /** 提案根拠の説明 */
  rationale: string;
  /** 推奨する支援内容の候補 */
  suggestedSupports: string[];
  /** 優先度 */
  priority: GoalPriority;
  /** 根拠の出典（どのデータソースから導出したか） */
  provenance: string[];
  /** 推奨する目標タイプ */
  goalType: GoalItem['type'];
  /** 推奨ドメイン */
  domains: string[];
};

// ────────────────────────────────────────────
// 入力型
// ────────────────────────────────────────────

/** アセスメント要約（planning sheet の assessment セクション相当） */
export type AssessmentSummaryInput = {
  /** 対象行動名リスト */
  targetBehaviors: string[];
  /** 行動の機能仮説 */
  hypotheses: Array<{ function: string; evidence: string; confidence: 'low' | 'medium' | 'high' }>;
  /** リスクレベル */
  riskLevel: 'low' | 'medium' | 'high';
  /** 健康上の要因 */
  healthFactors: string[];
};

/** Iceberg 分析要約 */
export type IcebergSummaryInput = {
  /** 行動観察の事実（observationFacts の要約テキスト） */
  observationFacts: string;
  /** 支援課題（supportIssues の要約テキスト） */
  supportIssues: string;
  /** 対応方針（supportPolicy の要約テキスト） */
  supportPolicy: string;
  /** 関わり方の具体策 */
  concreteApproaches: string;
  /** 対象場面 */
  targetScene: string;
  /** 対象領域 */
  targetDomain: string;
};

/** モニタリング要約 */
export type MonitoringSummaryInput = {
  /** モニタリング計画テキスト */
  monitoringPlan: string;
  /** 見直しタイミング */
  reviewTiming: string;
  /** 計画変更推奨 */
  planChangeRequired: boolean;
  /** 改善メモ */
  improvementIdeas: string;
};

/** buildSuggestedGoals への入力 */
export type SuggestedGoalsInput = {
  /** アセスメント情報（複数シートから結合可） */
  assessments: AssessmentSummaryInput[];
  /** Iceberg 分析情報（複数シートから結合可） */
  icebergSummaries: IcebergSummaryInput[];
  /** モニタリング情報 */
  monitoring: MonitoringSummaryInput | null;
  /** 既存の goals（重複排除用） */
  existingGoals: GoalItem[];
  /** アセスメント概要テキスト（フォームの assessmentSummary） */
  assessmentSummaryText: string;
  /** ストレングス */
  strengths: string;
};

// ────────────────────────────────────────────
// キーワード → ドメイン マッピング
// ────────────────────────────────────────────

type DomainKeywordRule = {
  domain: string;
  keywords: string[];
};

const DOMAIN_KEYWORD_RULES: DomainKeywordRule[] = [
  {
    domain: 'health',
    keywords: ['健康', '体調', '服薬', '睡眠', '食事', '栄養', '医療', '通院', '体重', '発作', 'てんかん', '生活習慣'],
  },
  {
    domain: 'motor',
    keywords: ['運動', '感覚', '歩行', '姿勢', '動作', '筋力', '転倒', 'バランス', '移動', '手先', '巧緻性', '感覚過敏'],
  },
  {
    domain: 'cognitive',
    keywords: ['認知', '行動', '注意', '記憶', '理解', '判断', '学習', '問題行動', '自傷', '他害', 'こだわり', 'パニック', '切替', '見通し'],
  },
  {
    domain: 'language',
    keywords: ['言語', 'コミュニケーション', '発話', '表現', '会話', '意思', '伝達', '要求', '応答', '理解力', 'やりとり'],
  },
  {
    domain: 'social',
    keywords: ['社会', '人間関係', '参加', '活動', '集団', '余暇', '就労', '地域', '社交', '対人', 'ルール', '順番', '協調'],
  },
];

// ────────────────────────────────────────────
// 内部ユーティリティ
// ────────────────────────────────────────────

let _counter = 0;

/** 候補用の一意 ID を生成する */
export function generateSuggestionId(): string {
  _counter += 1;
  return `suggestion-${Date.now()}-${_counter}`;
}

/** @internal テスト用にカウンターをリセット */
export function _resetCounter(): void {
  _counter = 0;
}

/** テキストからドメインを推論する */
export function inferDomains(text: string): string[] {
  const matched: string[] = [];
  const lowerText = text.toLowerCase();
  for (const rule of DOMAIN_KEYWORD_RULES) {
    if (rule.keywords.some((kw) => lowerText.includes(kw))) {
      matched.push(rule.domain);
    }
  }
  return matched.length > 0 ? matched : ['cognitive']; // デフォルト: 認知・行動
}

/** 既存 goals にテキストが類似するか判定（簡易部分一致） */
function isDuplicate(title: string, existingGoals: GoalItem[]): boolean {
  const normalized = title.replace(/\s+/g, '').toLowerCase();
  return existingGoals.some((g) => {
    const existingNorm = (g.label + g.text).replace(/\s+/g, '').toLowerCase();
    // 8文字以上の共通部分があれば重複とみなす
    return (
      normalized.length >= 8 &&
      (existingNorm.includes(normalized.slice(0, 8)) ||
        normalized.includes(existingNorm.slice(0, 8)))
    );
  });
}

/** テキストを行に分割して空行を除去する */
function splitLines(text: string): string[] {
  return text
    .split(/[。\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ────────────────────────────────────────────
// 候補生成ルール
// ────────────────────────────────────────────

/** アセスメントから長期目標候補を生成する */
function suggestFromAssessments(
  assessments: AssessmentSummaryInput[],
  existingGoals: GoalItem[],
): GoalSuggestion[] {
  const suggestions: GoalSuggestion[] = [];

  for (const assessment of assessments) {
    // 高リスクの場合 → リスク軽減の長期目標を提案
    if (assessment.riskLevel === 'high') {
      const title = 'リスク軽減に向けた安全な環境の確保';
      if (!isDuplicate(title, existingGoals)) {
        suggestions.push({
          id: generateSuggestionId(),
          title,
          rationale: 'アセスメントにおいてリスクレベルが「高」と評価されています。安全確保を最優先目標とすることを推奨します。',
          suggestedSupports: [
            '危機時のエスカレーション手順の整備',
            '環境調整による刺激の低減',
            '定期的なリスクモニタリングの実施',
          ],
          priority: 'high',
          provenance: ['アセスメント: リスクレベル＝高'],
          goalType: 'long',
          domains: ['health'],
        });
      }
    }

    // 対象行動から短期目標を提案
    for (const behavior of assessment.targetBehaviors) {
      if (!behavior) continue;
      const title = `${behavior}の頻度・強度の低減`;
      if (!isDuplicate(title, existingGoals)) {
        suggestions.push({
          id: generateSuggestionId(),
          title,
          rationale: `対象行動「${behavior}」が特定されています。具体的で測定可能な行動目標の設定を推奨します。`,
          suggestedSupports: [
            `${behavior}発生時の対応手順の統一`,
            '代替行動の指導',
            '前兆行動への早期介入',
          ],
          priority: 'high',
          provenance: [`アセスメント: 対象行動「${behavior}」`],
          goalType: 'short',
          domains: inferDomains(behavior),
        });
      }
    }

    // 仮説から支援内容の候補を提案
    for (const hyp of assessment.hypotheses) {
      if (!hyp.function || hyp.confidence === 'low') continue;
      const title = `行動の機能（${hyp.function}）に基づく代替手段の獲得`;
      if (!isDuplicate(title, existingGoals)) {
        suggestions.push({
          id: generateSuggestionId(),
          title,
          rationale: `行動の機能が「${hyp.function}」と仮説されています（信頼度: ${hyp.confidence}）。この機能を満たす代替行動の獲得を目標とすることを推奨します。`,
          suggestedSupports: [
            `${hyp.function}の要求を適切に表現する方法の指導`,
            '機能的等価行動（FCT）の訓練',
          ],
          priority: hyp.confidence === 'high' ? 'high' : 'medium',
          provenance: [`アセスメント: 機能仮説「${hyp.function}」（${hyp.confidence}）`],
          goalType: 'support',
          domains: inferDomains(hyp.function + ' ' + hyp.evidence),
        });
      }
    }

    // 健康要因があれば健康目標を提案
    if (assessment.healthFactors.length > 0) {
      const factorsStr = assessment.healthFactors.join('・');
      const title = '健康管理体制の整備';
      if (!isDuplicate(title, existingGoals)) {
        suggestions.push({
          id: generateSuggestionId(),
          title,
          rationale: `健康上の要因（${factorsStr}）が確認されています。行動支援と並行した健康管理を推奨します。`,
          suggestedSupports: assessment.healthFactors.map((f) => `${f}に関する定期確認と記録`),
          priority: 'medium',
          provenance: [`アセスメント: 健康要因（${factorsStr}）`],
          goalType: 'long',
          domains: ['health'],
        });
      }
    }
  }

  return suggestions;
}

/** Iceberg 分析から目標候補を生成する */
function suggestFromIceberg(
  summaries: IcebergSummaryInput[],
  existingGoals: GoalItem[],
): GoalSuggestion[] {
  const suggestions: GoalSuggestion[] = [];

  for (const summary of summaries) {
    // supportIssues から課題ベースの目標を提案
    const issues = splitLines(summary.supportIssues);
    for (const issue of issues.slice(0, 3)) {
      // 最大3件
      const title = issue.length > 40 ? issue.slice(0, 40) + '…' : issue;
      if (!isDuplicate(title, existingGoals)) {
        const domains = inferDomains(
          `${summary.targetDomain} ${summary.targetScene} ${issue}`,
        );
        suggestions.push({
          id: generateSuggestionId(),
          title,
          rationale: `Iceberg分析で支援課題として「${issue}」が特定されています。`,
          suggestedSupports: summary.concreteApproaches
            ? splitLines(summary.concreteApproaches).slice(0, 3)
            : [],
          priority: 'medium',
          provenance: [
            `Iceberg分析: 支援課題`,
            ...(summary.targetScene ? [`場面: ${summary.targetScene}`] : []),
          ],
          goalType: 'short',
          domains,
        });
      }
    }

    // supportPolicy から長期方針を提案
    if (summary.supportPolicy) {
      const policyLines = splitLines(summary.supportPolicy);
      for (const policy of policyLines.slice(0, 2)) {
        const title = policy.length > 40 ? policy.slice(0, 40) + '…' : policy;
        if (!isDuplicate(title, existingGoals)) {
          suggestions.push({
            id: generateSuggestionId(),
            title,
            rationale: `Iceberg分析の対応方針に基づく目標候補です。`,
            suggestedSupports: [],
            priority: 'medium',
            provenance: ['Iceberg分析: 対応方針'],
            goalType: 'long',
            domains: inferDomains(`${summary.targetDomain} ${policy}`),
          });
        }
      }
    }
  }

  return suggestions;
}

/** モニタリング情報から改善目標を提案する */
function suggestFromMonitoring(
  monitoring: MonitoringSummaryInput | null,
  existingGoals: GoalItem[],
): GoalSuggestion[] {
  if (!monitoring) return [];
  const suggestions: GoalSuggestion[] = [];

  // 計画変更推奨の場合
  if (monitoring.planChangeRequired) {
    const title = 'モニタリング結果に基づく計画見直し';
    if (!isDuplicate(title, existingGoals)) {
      suggestions.push({
        id: generateSuggestionId(),
        title,
        rationale: 'モニタリングにより計画変更が推奨されています。現状に合わせた目標の再設定を推奨します。',
        suggestedSupports: [
          '現行目標の達成度評価',
          '新たなニーズの再アセスメント',
          '目標と支援内容の再設計',
        ],
        priority: 'high',
        provenance: ['モニタリング: 計画変更推奨'],
        goalType: 'long',
        domains: ['cognitive'],
      });
    }
  }

  // 改善メモから提案
  if (monitoring.improvementIdeas) {
    const ideas = splitLines(monitoring.improvementIdeas);
    for (const idea of ideas.slice(0, 3)) {
      const title = idea.length > 40 ? idea.slice(0, 40) + '…' : idea;
      if (!isDuplicate(title, existingGoals)) {
        suggestions.push({
          id: generateSuggestionId(),
          title,
          rationale: '改善メモに記載された案を目標候補として提案します。',
          suggestedSupports: [],
          priority: 'low',
          provenance: ['改善メモ'],
          goalType: 'support',
          domains: inferDomains(idea),
        });
      }
    }
  }

  return suggestions;
}

/** アセスメント概要テキストとストレングスから補足提案 */
function suggestFromFormText(
  assessmentSummaryText: string,
  strengths: string,
  existingGoals: GoalItem[],
): GoalSuggestion[] {
  const suggestions: GoalSuggestion[] = [];

  // ストレングスがあればそれを活かす目標を提案
  if (strengths) {
    const strengthLines = splitLines(strengths);
    for (const s of strengthLines.slice(0, 2)) {
      const title = `ストレングス「${s.slice(0, 20)}」を活かした活動拡大`;
      if (!isDuplicate(title, existingGoals)) {
        suggestions.push({
          id: generateSuggestionId(),
          title,
          rationale: `ご本人のストレングスとして「${s}」が記録されています。これを活かした支援を推奨します。`,
          suggestedSupports: [
            `${s}を活用した新しい活動機会の提供`,
            `${s}に基づく成功体験の蓄積`,
          ],
          priority: 'low',
          provenance: ['フォーム: ストレングス'],
          goalType: 'long',
          domains: inferDomains(s),
        });
      }
    }
  }

  return suggestions;
}

// ────────────────────────────────────────────
// 優先度ソート
// ────────────────────────────────────────────

const PRIORITY_ORDER: Record<GoalPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function sortByPriority(suggestions: GoalSuggestion[]): GoalSuggestion[] {
  return [...suggestions].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

// ────────────────────────────────────────────
// メインビルダー
// ────────────────────────────────────────────

/**
 * 既存データから目標候補を生成する。
 *
 * ルール:
 * 1. アセスメント（リスク / 対象行動 / 仮説 / 健康要因）
 * 2. Iceberg 分析（支援課題 / 対応方針）
 * 3. モニタリング（計画変更推奨 / 改善メモ）
 * 4. フォームテキスト（ストレングス）
 *
 * - 既存 goals との重複は自動除外
 * - 優先度順にソートして返す
 * - 最大 15 件に制限
 */
export function buildSuggestedGoals(input: SuggestedGoalsInput): GoalSuggestion[] {
  const all: GoalSuggestion[] = [
    ...suggestFromAssessments(input.assessments, input.existingGoals),
    ...suggestFromIceberg(input.icebergSummaries, input.existingGoals),
    ...suggestFromMonitoring(input.monitoring, input.existingGoals),
    ...suggestFromFormText(
      input.assessmentSummaryText,
      input.strengths,
      input.existingGoals,
    ),
  ];

  return sortByPriority(all).slice(0, 15);
}

/**
 * GoalSuggestion → GoalItem 変換ヘルパー。
 * ユーザーが候補を「採用」したときに使う。
 */
export function suggestionToGoalItem(suggestion: GoalSuggestion): GoalItem {
  return {
    id: suggestion.id,
    type: suggestion.goalType,
    label: suggestion.title,
    text: suggestion.rationale,
    domains: suggestion.domains,
  };
}
