/**
 * @fileoverview 提案アクション — メモ転記・dismiss の型とロジック（pure function）
 * @description
 * Issue #9: Suggestion Action Bridge
 *
 * BehaviorPatternSuggestion を「メモに残す」「閉じる」の2操作で扱う。
 * specialNotes への転記テキスト生成、二重転記防止を担当する。
 *
 * 原則:
 * - 断定しない語法を維持（suggestion.message をそのまま転記）
 * - 転記は追記のみ（既存メモを上書きしない）
 * - domain 層は UI に依存しない pure function
 */

// contract:allow-interface — domain-specific action types co-located with logic
import type { PatternSuggestion, SuggestionCategory } from './behaviorPatternSuggestions';

// ─── 型定義 ──────────────────────────────────────────────

export type SuggestionActionType = 'accept' | 'dismiss';

export type SuggestionAction = {
  /** 操作種別 */
  action: SuggestionActionType;
  /** 提案の ruleId */
  ruleId: string;
  /** 提案のカテゴリ */
  category: SuggestionCategory;
  /** 提案のメッセージ（転記文） */
  message: string;
  /** 根拠文 */
  evidence: string;
  /** 操作日時（ISO8601） */
  timestamp: string;
  /** 対象利用者 ID */
  userId: string;
};

// ─── 定数 ────────────────────────────────────────────────

const MEMO_SEPARATOR = '\n---\n';
const MEMO_PREFIX = '【気づきメモ】';

// ─── 転記テキスト生成 ────────────────────────────────────

/**
 * 提案を specialNotes に追記するためのテキストを生成する。
 * suggestion.message をそのまま転記し、evidence の短い要約を付与する。
 *
 * @example
 * ```
 * ---
 * 【気づきメモ】午前に「不安傾向」タグが多くみられる傾向があります。(2026-03-14)
 * 根拠: 不安傾向: 3/5件 (60%)
 * ```
 */
export function buildSuggestionMemoText(
  suggestion: PatternSuggestion,
  date: string,
): string {
  const lines = [
    `${MEMO_PREFIX}${suggestion.message}（${date}）`,
    `根拠: ${suggestion.evidence}`,
  ];
  return lines.join('\n');
}

/**
 * 既存の specialNotes にメモを追記する。
 * 既存テキストがあればセパレータで区切る。
 */
export function appendSuggestionMemo(
  currentNotes: string,
  suggestion: PatternSuggestion,
  date: string,
): string {
  const memo = buildSuggestionMemoText(suggestion, date);
  const trimmed = currentNotes.trim();
  if (!trimmed) return memo;
  return `${trimmed}${MEMO_SEPARATOR}${memo}`;
}

// ─── SuggestionAction 生成 ───────────────────────────────

/**
 * accept/dismiss の SuggestionAction レコードを生成する。
 */
export function createSuggestionAction(
  suggestion: PatternSuggestion,
  action: SuggestionActionType,
  userId: string,
): SuggestionAction {
  return {
    action,
    ruleId: suggestion.ruleId,
    category: suggestion.category,
    message: suggestion.message,
    evidence: suggestion.evidence,
    timestamp: new Date().toISOString(),
    userId,
  };
}

// ─── 二重転記防止 ────────────────────────────────────────

/**
 * 指定 ruleId + message の提案が既に accept 済みかを判定する。
 * ruleId だけでなく message も照合することで、
 * 同じルールから異なる文言の提案が出た場合に対応する。
 */
export function isAlreadyAccepted(
  acceptedSuggestions: SuggestionAction[] | undefined,
  ruleId: string,
  message: string,
): boolean {
  return (acceptedSuggestions ?? []).some(
    a => a.action === 'accept' && a.ruleId === ruleId && a.message === message,
  );
}

/**
 * 指定 ruleId + message の提案が既にアクション済み（accept or dismiss）かを判定する。
 * パネル表示時のフィルタリングに使用。
 */
export function isAlreadyActioned(
  acceptedSuggestions: SuggestionAction[] | undefined,
  ruleId: string,
  message: string,
): boolean {
  return (acceptedSuggestions ?? []).some(
    a => a.ruleId === ruleId && a.message === message,
  );
}
