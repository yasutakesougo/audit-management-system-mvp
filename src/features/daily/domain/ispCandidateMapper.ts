/**
 * @fileoverview ISP Candidate Mapper — 提案 → ISP候補変換（pure function）
 * @description
 * Issue #10: Suggestion → ISP Candidate Bridge
 *
 * acceptedSuggestions（Issue #9）から ISP 候補を生成する。
 * Phase 1 では improvementIdeas へのテキスト追記で候補の痕跡を残す。
 *
 * 原則:
 * - accept 済みの提案のみを候補化する
 * - positive-signal は Phase 1 では対象外（Phase 2 で strengths 連携）
 * - domainHints は「候補」であり「断定」ではない
 * - 重複候補は sourceRuleId + userId + message で防止
 * - domain 層は UI に依存しない pure function
 */

import type { SuggestionAction } from './suggestionAction';
import type { SuggestionCategory } from './behaviorPatternSuggestions';

// ─── 型定義 ──────────────────────────────────────────────

/** ISP候補の出自 */
export type CandidateSource = 'behavior-pattern-suggestion';

/** ISP候補の状態（Phase 1 では pending のみ使用） */
export type CandidateStatus = 'pending' | 'adopted' | 'rejected';

/** ISP Candidate — 提案から生成された支援計画候補 */
export type ISPCandidate = {
  /** 一意識別子 */
  id: string;
  /** 対象利用者ID */
  userId: string;
  /** 候補テキスト */
  text: string;
  /** 候補カテゴリ */
  category: SuggestionCategory;
  /** 出自 */
  source: CandidateSource;
  /** 元の ruleId */
  sourceRuleId: string;
  /** 元の evidence */
  sourceEvidence: string;
  /** 候補ステータス */
  status: CandidateStatus;
  /** 生成日時 */
  createdAt: string;
  /** ISP の GoalItem type への候補（断定ではない） */
  suggestedGoalType: 'short' | 'support';
  /** ISP の domain への候補ヒント（断定ではない） */
  domainHints: string[];
};

// ─── 定数 ────────────────────────────────────────────────

const CANDIDATE_SEPARATOR = '\n---\n';
const CANDIDATE_HEADER = '【行動パターンからの候補】';

/** Phase 1 対象外カテゴリ */
const EXCLUDED_CATEGORIES: ReadonlySet<SuggestionCategory> = new Set([
  'positive-signal',
]);

/** カテゴリ → suggestedGoalType マッピング */
const CATEGORY_GOAL_TYPE_MAP: Record<string, ISPCandidate['suggestedGoalType']> = {
  'co-occurrence': 'support',
  'slot-bias': 'short',
  'tag-density': 'support',
};

/**
 * タグキー → ドメインヒント マッピング
 * ※ これは「候補」であり断定ではない。ISP 担当者が最終判断する。
 */
const TAG_DOMAIN_HINTS: Record<string, string[]> = {
  panic: ['cognitive'],
  sensory: ['health', 'cognitive'],
  elopement: ['cognitive', 'social'],
  verbalRequest: ['language'],
  gestureRequest: ['language'],
  echolalia: ['language'],
  eating: ['health'],
  toileting: ['health'],
  sleeping: ['health'],
  cooperation: ['social'],
  selfRegulation: ['cognitive'],
  newSkill: ['cognitive', 'motor'],
};

const DEFAULT_DOMAIN_HINTS = ['cognitive'];

// ─── マッパー関数 ─────────────────────────────────────────

/**
 * 単一の SuggestionAction から ISPCandidate を生成する。
 * 対象外の場合は null を返す。
 */
export function mapAcceptedToCandidate(
  action: SuggestionAction,
  existingCandidates: ISPCandidate[],
): ISPCandidate | null {
  // dismiss は対象外
  if (action.action !== 'accept') return null;

  // Phase 1 対象外カテゴリ
  if (EXCLUDED_CATEGORIES.has(action.category as SuggestionCategory)) return null;

  // 重複防止
  if (isAlreadyCandidated(existingCandidates, action.ruleId, action.userId, action.message)) {
    return null;
  }

  const suggestedGoalType = CATEGORY_GOAL_TYPE_MAP[action.category] ?? 'support';
  const domainHints = deriveDomainHints(action.message);

  return {
    id: `cand-${action.ruleId}-${action.userId}-${Date.now()}`,
    userId: action.userId,
    text: action.message,
    category: action.category as SuggestionCategory,
    source: 'behavior-pattern-suggestion',
    sourceRuleId: action.ruleId,
    sourceEvidence: action.evidence,
    status: 'pending',
    createdAt: new Date().toISOString(),
    suggestedGoalType,
    domainHints,
  };
}

/**
 * 全 UserRowData の acceptedSuggestions から ISP 候補を一括収集する。
 */
export function collectISPCandidates(
  allAcceptedSuggestions: SuggestionAction[],
  existingCandidates: ISPCandidate[] = [],
): ISPCandidate[] {
  const result: ISPCandidate[] = [];
  const seen = new Set(
    existingCandidates.map(c => `${c.sourceRuleId}::${c.userId}::${c.text}`),
  );

  for (const action of allAcceptedSuggestions) {
    const candidate = mapAcceptedToCandidate(action, existingCandidates);
    if (!candidate) continue;

    const key = `${candidate.sourceRuleId}::${candidate.userId}::${candidate.text}`;
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(candidate);
  }

  return result;
}

// ─── テキスト生成 ─────────────────────────────────────────

/**
 * ISP候補を improvementIdeas に追記するためのテキストを生成する。
 * 末尾にメタ印 [source:rule=xxx user=xxx] を付与して重複判定を容易にする。
 */
export function buildCandidateText(candidate: ISPCandidate): string {
  const goalTypeLabel = candidate.suggestedGoalType === 'short' ? '短期目標候補' : '支援内容候補';
  const meta = `[source:rule=${candidate.sourceRuleId} user=${candidate.userId}]`;

  const lines = [
    `${CANDIDATE_HEADER}`,
    `${candidate.text}`,
    `根拠: ${candidate.sourceEvidence}`,
    `→ ${goalTypeLabel}`,
    meta,
  ];
  return lines.join('\n');
}

/**
 * 既存の improvementIdeas にテキストを追記する。
 */
export function appendCandidateToImprovementIdeas(
  currentText: string,
  candidate: ISPCandidate,
): string {
  const candidateText = buildCandidateText(candidate);
  const trimmed = currentText.trim();
  if (!trimmed) return candidateText;
  return `${trimmed}${CANDIDATE_SEPARATOR}${candidateText}`;
}

// ─── 重複防止 ─────────────────────────────────────────────

/**
 * 指定の ruleId + userId + message が既に候補化済みかを判定する。
 */
export function isAlreadyCandidated(
  existingCandidates: ISPCandidate[],
  ruleId: string,
  userId: string,
  message: string,
): boolean {
  return existingCandidates.some(
    c => c.sourceRuleId === ruleId && c.userId === userId && c.text === message,
  );
}

/**
 * improvementIdeas テキスト内にメタ印が含まれているかで重複判定する。
 * Phase 1 の軽い照合。
 */
export function isAlreadyInImprovementIdeas(
  improvementIdeas: string,
  ruleId: string,
  userId: string,
): boolean {
  const meta = `[source:rule=${ruleId} user=${userId}]`;
  return improvementIdeas.includes(meta);
}

// ─── ヘルパー ─────────────────────────────────────────────

/**
 * message やタグ情報からドメインヒントを推論する。
 * ※ これは「候補」であり断定ではない。
 */
function deriveDomainHints(message: string): string[] {
  const hints = new Set<string>();

  for (const [tagKey, domains] of Object.entries(TAG_DOMAIN_HINTS)) {
    // タグキーまたはそのラベルがメッセージに含まれていれば候補とする
    if (message.includes(tagKey)) {
      for (const d of domains) hints.add(d);
    }
  }

  // 汎用キーワード照合
  if (message.includes('パニック') || message.includes('不安')) hints.add('cognitive');
  if (message.includes('感覚')) { hints.add('health'); hints.add('cognitive'); }
  if (message.includes('離席') || message.includes('離園')) { hints.add('cognitive'); hints.add('social'); }
  if (message.includes('食事') || message.includes('排泄') || message.includes('睡眠')) hints.add('health');
  if (message.includes('協力') || message.includes('社会')) hints.add('social');
  if (message.includes('言語') || message.includes('要求')) hints.add('language');

  return hints.size > 0 ? Array.from(hints) : DEFAULT_DOMAIN_HINTS;
}
