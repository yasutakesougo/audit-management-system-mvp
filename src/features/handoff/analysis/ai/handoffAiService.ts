/**
 * Phase 3-E: 申し送りAIサービス — オーケストレーション + フォールバック
 *
 * @description
 * Phase 1-2 の計算結果を受け取り、AI要約を生成する。
 * AI 失敗時は数値ベースのフォールバック要約を自動生成。
 *
 * 設計方針:
 * - AI は分析しない。分析結果を言語化するだけ
 * - AI 失敗時は数値 UI だけで成立する
 * - 根拠データへの参照を維持する
 */

import type { AiClient } from '@/lib/ai/aiClientTypes';
import type {
  FallbackInsightReport,
  HandoffSummaryInput,
  InsightReportResult,
} from './aiTypes';
import { buildHandoffSummaryPrompt } from './buildHandoffSummaryPrompt';
import { parseInsightReport } from './parseInsightReport';

// ────────────────────────────────────────────────────────────
// システムプロンプト
// ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT =
  '福祉事業所の支援品質改善アドバイザーとして、JSON形式のみで回答してください。JSON以外の文字は含めないでください。';

// ────────────────────────────────────────────────────────────
// メイン関数
// ────────────────────────────────────────────────────────────

/**
 * Phase 1-2 の分析結果をもとに AI 要約を生成する。
 *
 * @param input Phase 1-2 の集約済み分析結果
 * @param client AI クライアント（Azure OpenAI / Mock）
 * @returns AI生成レポート or フォールバックレポート
 *
 * @example
 * ```ts
 * const report = await generateHandoffInsight(summaryInput, aiClient);
 * if (report.meta.isAiGenerated) {
 *   // AI 生成
 * } else {
 *   // フォールバック（数値ベース）
 * }
 * ```
 */
export async function generateHandoffInsight(
  input: HandoffSummaryInput,
  client: AiClient,
): Promise<InsightReportResult> {
  try {
    // 1. プロンプト生成（Pure Function）
    const prompt = buildHandoffSummaryPrompt(input);

    // 2. AI 呼び出し
    const response = await client.chat(prompt, {
      systemPrompt: SYSTEM_PROMPT,
      temperature: 0.3,
      maxTokens: 800,
    });

    // 3. パース（Pure Function）
    const parsed = parseInsightReport(response.content, response.model);
    if (parsed) return parsed;

    // パース失敗 → フォールバック
    return buildFallbackReport(input, 'AIの応答を解析できませんでした');
  } catch (error) {
    // ネットワークエラー、認証エラー、タイムアウト等
    return buildFallbackReport(
      input,
      error instanceof Error ? error.message : 'AI接続に失敗しました',
    );
  }
}

// ────────────────────────────────────────────────────────────
// フォールバック（AI 無しで数値ベースの要約を生成）
// ────────────────────────────────────────────────────────────

/**
 * Phase 1-2 の数値データだけで「読める」レポートを生成する。
 *
 * AI が落ちても、ユーザーは最低限のインサイトを得られる。
 */
export function buildFallbackReport(
  input: HandoffSummaryInput,
  reason: string,
): FallbackInsightReport {
  const { totalRecords, criticalCount, alerts, highRiskUsers,
          topKeywords, context, trendingUsers } = input;

  // ── summary 生成 ──
  const summaryParts: string[] = [];
  summaryParts.push(`${context.periodLabel}の申し送り${totalRecords}件を分析しました`);

  if (criticalCount > 0) {
    summaryParts.push(`重要・未対応が${criticalCount}件あります`);
  }

  if (alerts.length > 0) {
    summaryParts.push(`${alerts.length}件のアラートが検出されています`);
  }

  const increasing = trendingUsers.filter(u => u.recentTrend === 'increasing');
  if (increasing.length > 0) {
    summaryParts.push(`${increasing.length}名の利用者で申し送りが増加傾向です`);
  }

  if (topKeywords.length > 0) {
    summaryParts.push(`注目キーワード: ${topKeywords.slice(0, 3).map(k => k.keyword).join('・')}`);
  }

  // ── keyPoints 生成 ──
  const keyPoints: string[] = [];
  if (criticalCount > 0) {
    keyPoints.push(`重要・未対応: ${criticalCount}件`);
  }
  for (const a of alerts.slice(0, 2)) {
    keyPoints.push(`${a.userDisplayName}: ${a.label}`);
  }

  // ── suggestedActions 生成 ──
  const suggestedActions: string[] = [];
  const criticalOrHigh = highRiskUsers.filter(
    u => u.level === 'critical' || u.level === 'high',
  );
  for (const u of criticalOrHigh.slice(0, 2)) {
    suggestedActions.push(`${u.userDisplayName}: ${u.topSuggestion}`);
  }
  if (suggestedActions.length === 0 && alerts.length > 0) {
    suggestedActions.push(alerts[0].suggestion);
  }

  // ── userHighlights 生成 ──
  const userHighlights = highRiskUsers.slice(0, 3).map(u => ({
    userDisplayName: u.userDisplayName,
    note: `リスクスコア${u.score}点(${u.level})`,
  }));

  return {
    summary: summaryParts.join('。') + '。',
    keyPoints: keyPoints.slice(0, 3),
    suggestedActions: suggestedActions.slice(0, 3),
    userHighlights,
    meta: {
      generatedAt: new Date().toISOString(),
      model: 'fallback',
      isAiGenerated: false,
      reason,
    },
  };
}
