/**
 * Phase 3-C: AI出力パーサー — Pure Function
 *
 * @description
 * Azure OpenAI の応答文字列をパースし、
 * 型安全な HandoffInsightReport に変換する。
 *
 * 設計方針:
 * - 外部依存ゼロ
 * - パース失敗は null を返す（例外を投げない）
 * - バリデーション付き（summary 200字制限等）
 * - マークダウンコードブロック内のJSONにも対応
 */

import type { HandoffInsightReport } from './aiTypes';

// ────────────────────────────────────────────────────────────
// 定数
// ────────────────────────────────────────────────────────────

/** summary の最大文字数 */
const MAX_SUMMARY_LENGTH = 200;
/** keyPoints の最大件数 */
const MAX_KEY_POINTS = 3;
/** suggestedActions の最大件数 */
const MAX_SUGGESTED_ACTIONS = 3;
/** userHighlights の最大件数 */
const MAX_USER_HIGHLIGHTS = 5;

// ────────────────────────────────────────────────────────────
// JSON 抽出
// ────────────────────────────────────────────────────────────

/**
 * AI応答文字列からJSON部分を抽出する。
 *
 * 対応パターン:
 * 1. ```json ... ``` ブロック
 * 2. ``` ... ``` ブロック（言語指定なし）
 * 3. 直接JSONオブジェクト
 *
 * @returns JSON文字列。抽出できない場合は元の文字列をそのまま返す。
 */
export function extractJsonFromResponse(response: string): string {
  if (!response || response.trim() === '') return '';

  // パターン1: ```json ... ``` or ``` ... ```
  const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // パターン2: 直接JSON（{ で始まり } で終わる最大範囲）
  const firstBrace = response.indexOf('{');
  const lastBrace = response.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return response.substring(firstBrace, lastBrace + 1);
  }

  // 抽出できない場合はそのまま返す
  return response.trim();
}

// ────────────────────────────────────────────────────────────
// バリデーション
// ────────────────────────────────────────────────────────────

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string');
}

interface RawUserHighlight {
  userDisplayName?: unknown;
  note?: unknown;
}

function isUserHighlightArray(value: unknown): value is RawUserHighlight[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    v => typeof v === 'object' && v !== null,
  );
}

// ────────────────────────────────────────────────────────────
// メイン関数
// ────────────────────────────────────────────────────────────

/**
 * AI応答文字列をパースし、型安全な HandoffInsightReport に変換する。
 *
 * @param rawResponse AI応答の生文字列
 * @param model 使用されたモデル名
 * @param generatedAt 生成日時（テスト用に外部注入可能）
 * @returns パース成功時は HandoffInsightReport、失敗時は null
 *
 * @example
 * ```ts
 * const report = parseInsightReport(aiResponse.content, aiResponse.model);
 * if (report) {
 *   // 型安全に使える
 *   console.log(report.summary);
 * }
 * ```
 */
export function parseInsightReport(
  rawResponse: string,
  model: string,
  generatedAt?: string,
): HandoffInsightReport | null {
  if (!rawResponse || rawResponse.trim() === '') return null;

  try {
    const jsonStr = extractJsonFromResponse(rawResponse);
    if (!jsonStr) return null;

    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    // ── 必須フィールドの検証 ──
    if (!isNonEmptyString(parsed.summary)) return null;

    // ── keyPoints の検証と正規化 ──
    const rawKeyPoints = parsed.keyPoints;
    if (rawKeyPoints !== undefined && !isStringArray(rawKeyPoints)) return null;
    const keyPoints = isStringArray(rawKeyPoints)
      ? rawKeyPoints.filter(isNonEmptyString).slice(0, MAX_KEY_POINTS)
      : [];

    // ── suggestedActions の検証と正規化 ──
    const rawActions = parsed.suggestedActions;
    const suggestedActions = isStringArray(rawActions)
      ? rawActions.filter(isNonEmptyString).slice(0, MAX_SUGGESTED_ACTIONS)
      : [];

    // ── userHighlights の検証と正規化 ──
    const rawHighlights = parsed.userHighlights;
    const userHighlights = isUserHighlightArray(rawHighlights)
      ? rawHighlights
          .filter(h => isNonEmptyString(h.userDisplayName))
          .slice(0, MAX_USER_HIGHLIGHTS)
          .map(h => ({
            userDisplayName: String(h.userDisplayName),
            note: isNonEmptyString(h.note) ? String(h.note) : '',
          }))
      : [];

    return {
      summary: (parsed.summary as string).slice(0, MAX_SUMMARY_LENGTH),
      keyPoints,
      suggestedActions,
      userHighlights,
      meta: {
        generatedAt: generatedAt ?? new Date().toISOString(),
        model,
        isAiGenerated: true,
      },
    };
  } catch {
    // JSON.parse 失敗やその他のエラー
    return null;
  }
}
