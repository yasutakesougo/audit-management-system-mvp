/**
 * handoffAiService テスト
 *
 * Mock AI Client を使って以下を検証:
 * - AI 正常応答 → HandoffInsightReport
 * - AI パース失敗 → FallbackInsightReport
 * - AI 接続エラー → FallbackInsightReport
 * - フォールバック内容の正確性
 */

import { describe, it, expect } from 'vitest';
import { createMockAiClient } from '@/lib/ai/aiClient';
import type { HandoffSummaryInput } from '../aiTypes';
import { generateHandoffInsight, buildFallbackReport } from '../handoffAiService';

// ── テストヘルパー ──

function createInput(overrides: Partial<HandoffSummaryInput> = {}): HandoffSummaryInput {
  return {
    totalRecords: 42,
    criticalCount: 3,
    categoryBreakdown: [
      { category: '体調', count: 15 },
      { category: '行動面', count: 10 },
    ],
    topKeywords: [
      { keyword: '発熱', count: 8 },
      { keyword: '不穏', count: 5 },
      { keyword: '服薬', count: 4 },
    ],
    trendingUsers: [
      { userDisplayName: '田中太郎', recentTrend: 'increasing', topCategory: '体調', totalMentions: 12 },
      { userDisplayName: '佐藤花子', recentTrend: 'stable', topCategory: '行動面', totalMentions: 8 },
    ],
    alerts: [
      { label: '家族連絡が未対応3日経過', severity: 'critical', userDisplayName: '田中太郎', suggestion: '管理者へのエスカレーション' },
      { label: '行動面が週3回以上', severity: 'alert', userDisplayName: '佐藤花子', suggestion: 'ABC分析の実施' },
    ],
    highRiskUsers: [
      { userDisplayName: '田中太郎', score: 65, level: 'critical', topSuggestion: '管理者へのエスカレーション' },
      { userDisplayName: '佐藤花子', score: 42, level: 'high', topSuggestion: 'ABC分析の実施' },
    ],
    context: {
      periodLabel: '直近14日',
      facilityName: 'さくら園',
      audience: 'morning',
    },
    ...overrides,
  };
}

const VALID_AI_RESPONSE = JSON.stringify({
  summary: 'テスト要約です。体調面の申し送りが増加しています。',
  keyPoints: ['田中太郎さんの体調に注意', '家族連絡の未対応あり'],
  suggestedActions: ['看護師への相談を検討', 'ABC分析の実施'],
  userHighlights: [
    { userDisplayName: '田中太郎', note: '体調面3日連続' },
  ],
});

// ── generateHandoffInsight ──

describe('generateHandoffInsight', () => {
  it('AI 正常応答 → HandoffInsightReport を返す', async () => {
    const client = createMockAiClient({ response: VALID_AI_RESPONSE, model: 'gpt-4o-mini' });
    const input = createInput();

    const result = await generateHandoffInsight(input, client);

    expect(result.meta.isAiGenerated).toBe(true);
    expect(result.summary).toBe('テスト要約です。体調面の申し送りが増加しています。');
    expect(result.keyPoints).toEqual(['田中太郎さんの体調に注意', '家族連絡の未対応あり']);
    expect(result.suggestedActions).toEqual(['看護師への相談を検討', 'ABC分析の実施']);
    expect(result.userHighlights).toEqual([
      { userDisplayName: '田中太郎', note: '体調面3日連続' },
    ]);
    expect(result.meta.model).toBe('gpt-4o-mini');
  });

  it('AI応答がパース不能 → FallbackInsightReport を返す', async () => {
    const client = createMockAiClient({ response: 'これはJSONではありません' });
    const input = createInput();

    const result = await generateHandoffInsight(input, client);

    expect(result.meta.isAiGenerated).toBe(false);
    if (!result.meta.isAiGenerated) {
      expect(result.meta.model).toBe('fallback');
      expect(result.meta.reason).toContain('解析できませんでした');
    }
  });

  it('AI接続エラー → FallbackInsightReport を返す', async () => {
    const client = createMockAiClient({
      shouldError: true,
      errorMessage: 'Network timeout',
    });
    const input = createInput();

    const result = await generateHandoffInsight(input, client);

    expect(result.meta.isAiGenerated).toBe(false);
    if (!result.meta.isAiGenerated) {
      expect(result.meta.model).toBe('fallback');
      expect(result.meta.reason).toBe('Network timeout');
    }
  });

  it('AI応答に```jsonブロックを含む場合もパースできる', async () => {
    const wrappedResponse = `結果:\n\`\`\`json\n${VALID_AI_RESPONSE}\n\`\`\``;
    const client = createMockAiClient({ response: wrappedResponse });
    const input = createInput();

    const result = await generateHandoffInsight(input, client);

    expect(result.meta.isAiGenerated).toBe(true);
    expect(result.summary).toContain('テスト要約');
  });

  it('AI応答のsummaryが空 → FallbackInsightReport を返す', async () => {
    const emptyResponse = JSON.stringify({ summary: '', keyPoints: [] });
    const client = createMockAiClient({ response: emptyResponse });
    const input = createInput();

    const result = await generateHandoffInsight(input, client);

    expect(result.meta.isAiGenerated).toBe(false);
  });
});

// ── buildFallbackReport ──

describe('buildFallbackReport', () => {
  it('基本的なフォールバック要約を生成できる', () => {
    const input = createInput();
    const result = buildFallbackReport(input, 'テスト理由');

    expect(result.meta.isAiGenerated).toBe(false);
    expect(result.meta.model).toBe('fallback');
    expect(result.meta.reason).toBe('テスト理由');
    expect(result.summary).toContain('直近14日');
    expect(result.summary).toContain('42件');
  });

  it('criticalCount が含まれる', () => {
    const input = createInput({ criticalCount: 5 });
    const result = buildFallbackReport(input, '');

    expect(result.summary).toContain('重要・未対応が5件');
    expect(result.keyPoints).toContain('重要・未対応: 5件');
  });

  it('アラート情報が含まれる', () => {
    const input = createInput();
    const result = buildFallbackReport(input, '');

    expect(result.summary).toContain('2件のアラート');
    expect(result.keyPoints).toContain('田中太郎: 家族連絡が未対応3日経過');
  });

  it('増加傾向の利用者が含まれる', () => {
    const input = createInput();
    const result = buildFallbackReport(input, '');

    expect(result.summary).toContain('1名の利用者で申し送りが増加傾向');
  });

  it('キーワードが含まれる', () => {
    const input = createInput();
    const result = buildFallbackReport(input, '');

    expect(result.summary).toContain('発熱');
  });

  it('高リスク利用者の推奨アクションが含まれる', () => {
    const input = createInput();
    const result = buildFallbackReport(input, '');

    expect(result.suggestedActions).toContain('田中太郎: 管理者へのエスカレーション');
    expect(result.suggestedActions).toContain('佐藤花子: ABC分析の実施');
  });

  it('userHighlights にリスクスコアが含まれる', () => {
    const input = createInput();
    const result = buildFallbackReport(input, '');

    expect(result.userHighlights[0]).toEqual({
      userDisplayName: '田中太郎',
      note: 'リスクスコア65点(critical)',
    });
  });

  it('空データでもエラーにならない', () => {
    const input = createInput({
      totalRecords: 0,
      criticalCount: 0,
      alerts: [],
      highRiskUsers: [],
      topKeywords: [],
      trendingUsers: [],
    });

    const result = buildFallbackReport(input, 'テスト');
    expect(result.summary).toContain('0件');
    expect(result.keyPoints).toEqual([]);
    expect(result.suggestedActions).toEqual([]);
    expect(result.userHighlights).toEqual([]);
  });

  it('keyPoints は最大3件', () => {
    const input = createInput({
      criticalCount: 1,
      alerts: [
        { label: 'A1', severity: 'critical', userDisplayName: 'U1', suggestion: 'S1' },
        { label: 'A2', severity: 'alert', userDisplayName: 'U2', suggestion: 'S2' },
        { label: 'A3', severity: 'warning', userDisplayName: 'U3', suggestion: 'S3' },
      ],
    });

    const result = buildFallbackReport(input, '');
    expect(result.keyPoints.length).toBeLessThanOrEqual(3);
  });
});
