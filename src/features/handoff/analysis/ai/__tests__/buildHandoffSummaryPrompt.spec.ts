/**
 * buildHandoffSummaryPrompt テスト
 *
 * Pure Function なので外部依存なし。
 * プロンプトの構造・制約・audience分岐をテストする。
 */

import { describe, it, expect } from 'vitest';
import { buildHandoffSummaryPrompt } from '../buildHandoffSummaryPrompt';
import type { HandoffSummaryInput } from '../aiTypes';

// ── テスト用ヘルパー ──

function createMinimalInput(
  overrides: Partial<HandoffSummaryInput> = {},
): HandoffSummaryInput {
  return {
    totalRecords: 0,
    criticalCount: 0,
    categoryBreakdown: [],
    topKeywords: [],
    trendingUsers: [],
    alerts: [],
    highRiskUsers: [],
    context: {
      periodLabel: '直近14日',
      facilityName: 'テスト事業所',
      audience: 'morning',
    },
    ...overrides,
  };
}

function createFullInput(): HandoffSummaryInput {
  return {
    totalRecords: 42,
    criticalCount: 3,
    categoryBreakdown: [
      { category: '体調', count: 15 },
      { category: '行動面', count: 10 },
      { category: '家族連絡', count: 8 },
      { category: '支援の工夫', count: 5 },
      { category: 'その他', count: 4 },
    ],
    topKeywords: [
      { keyword: '発熱', count: 8 },
      { keyword: '不穏', count: 5 },
      { keyword: '服薬', count: 4 },
      { keyword: '食欲不振', count: 3 },
      { keyword: '転倒', count: 2 },
      { keyword: '笑顔', count: 2 }, // 6件目は出ないはず
    ],
    trendingUsers: [
      { userDisplayName: '田中太郎', recentTrend: 'increasing', topCategory: '体調', totalMentions: 12 },
      { userDisplayName: '佐藤花子', recentTrend: 'increasing', topCategory: '行動面', totalMentions: 8 },
      { userDisplayName: '鈴木一郎', recentTrend: 'stable', topCategory: '体調', totalMentions: 5 },
      { userDisplayName: '高橋次郎', recentTrend: 'increasing', topCategory: '家族連絡', totalMentions: 4 },
      { userDisplayName: '山田四郎', recentTrend: 'increasing', topCategory: 'その他', totalMentions: 3 },
      { userDisplayName: '渡辺三郎', recentTrend: 'decreasing', topCategory: '行動面', totalMentions: 3 },
    ],
    alerts: [
      { label: '家族連絡が未対応3日経過', severity: 'critical', userDisplayName: '田中太郎', suggestion: '管理者へのエスカレーション' },
      { label: '行動面が週3回以上', severity: 'alert', userDisplayName: '佐藤花子', suggestion: 'ABC分析の実施' },
      { label: '3日連続の体調報告', severity: 'warning', userDisplayName: '田中太郎', suggestion: '看護師への相談' },
      { label: '直近7日にリスク案件あり', severity: 'alert', userDisplayName: '鈴木一郎', suggestion: 'ヒヤリハット報告書の確認' },
      { label: '2日連続の重要案件', severity: 'warning', userDisplayName: '佐藤花子', suggestion: 'ケース会議での検討' },
      { label: 'テスト余剰アラート', severity: 'info', userDisplayName: 'テスト', suggestion: 'テスト' },
    ],
    highRiskUsers: [
      { userDisplayName: '田中太郎', score: 65, level: 'critical', topSuggestion: '管理者へのエスカレーション' },
      { userDisplayName: '佐藤花子', score: 42, level: 'high', topSuggestion: 'ABC分析の実施' },
      { userDisplayName: '鈴木一郎', score: 28, level: 'moderate', topSuggestion: 'ヒヤリハット報告書の確認' },
      { userDisplayName: '高橋次郎', score: 12, level: 'low', topSuggestion: '特に緊急の対応は不要' },
    ],
    context: {
      periodLabel: '直近14日',
      facilityName: 'さくら園',
      audience: 'morning',
    },
  };
}

// ── テスト ──

describe('buildHandoffSummaryPrompt', () => {
  it('空データでも安全にプロンプトが生成される', () => {
    const input = createMinimalInput();
    const prompt = buildHandoffSummaryPrompt(input);

    expect(prompt).toContain('テスト事業所');
    expect(prompt).toContain('直近14日');
    expect(prompt).toContain('総件数: 0件');
    expect(prompt).toContain('重要・未対応: 0件');
    expect(prompt).toContain('なし'); // キーワード等が「なし」
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('audience=morning で「朝会」が含まれる', () => {
    const input = createMinimalInput({ context: { periodLabel: '', facilityName: '', audience: 'morning' } });
    const prompt = buildHandoffSummaryPrompt(input);
    expect(prompt).toContain('朝会');
    expect(prompt).not.toContain('夕会');
    expect(prompt).not.toContain('管理者');
  });

  it('audience=evening で「夕会」が含まれる', () => {
    const input = createMinimalInput({ context: { periodLabel: '', facilityName: '', audience: 'evening' } });
    const prompt = buildHandoffSummaryPrompt(input);
    expect(prompt).toContain('夕会');
    expect(prompt).not.toContain('朝会向け');
  });

  it('audience=manager で「管理者」が含まれる', () => {
    const input = createMinimalInput({ context: { periodLabel: '', facilityName: '', audience: 'manager' } });
    const prompt = buildHandoffSummaryPrompt(input);
    expect(prompt).toContain('管理者');
  });

  it('キーワードは上位5件まで出力される', () => {
    const input = createFullInput();
    const prompt = buildHandoffSummaryPrompt(input);

    expect(prompt).toContain('発熱(8回)');
    expect(prompt).toContain('転倒(2回)');
    // 6件目は出ない
    expect(prompt).not.toContain('笑顔(2回)');
  });

  it('アラートは上位5件まで出力される', () => {
    const input = createFullInput();
    const prompt = buildHandoffSummaryPrompt(input);

    expect(prompt).toContain('アラート（6件）');
    expect(prompt).toContain('[critical] 田中太郎');
    expect(prompt).toContain('2日連続の重要案件');
    // 6件目は出ない
    expect(prompt).not.toContain('テスト余剰アラート');
  });

  it('高リスク利用者は critical/high のみ出力される', () => {
    const input = createFullInput();
    const prompt = buildHandoffSummaryPrompt(input);

    expect(prompt).toContain('田中太郎: 65点(critical)');
    expect(prompt).toContain('佐藤花子: 42点(high)');
    // moderate/low は含まない
    expect(prompt).not.toContain('鈴木一郎: 28点(moderate)');
    expect(prompt).not.toContain('高橋次郎: 12点(low)');
  });

  it('増加傾向の利用者のみ出力される（stable/decreasing は除外）', () => {
    const input = createFullInput();
    const prompt = buildHandoffSummaryPrompt(input);

    expect(prompt).toContain('田中太郎: 体調中心、12件');
    expect(prompt).toContain('佐藤花子: 行動面中心、8件');
    expect(prompt).toContain('高橋次郎: 家族連絡中心、4件');
    // stable は含まない
    expect(prompt).not.toContain('鈴木一郎: 体調中心、5件');
    // increasing でも4人目は上限超
    expect(prompt).not.toContain('山田四郎: その他中心、3件');
    // decreasing は含まない
    expect(prompt).not.toContain('渡辺三郎');
  });

  it('JSON出力形式の指示が含まれる', () => {
    const input = createMinimalInput();
    const prompt = buildHandoffSummaryPrompt(input);

    expect(prompt).toContain('"summary"');
    expect(prompt).toContain('"keyPoints"');
    expect(prompt).toContain('"suggestedActions"');
    expect(prompt).toContain('"userHighlights"');
    expect(prompt).toContain('JSON形式');
  });

  it('200字制限の指示が含まれる', () => {
    const input = createMinimalInput();
    const prompt = buildHandoffSummaryPrompt(input);
    expect(prompt).toContain('200字以内');
  });

  it('カテゴリ分布がある場合は出力される', () => {
    const input = createMinimalInput({
      categoryBreakdown: [
        { category: '体調', count: 10 },
        { category: '行動面', count: 5 },
      ],
    });
    const prompt = buildHandoffSummaryPrompt(input);
    expect(prompt).toContain('体調: 10件');
    expect(prompt).toContain('行動面: 5件');
  });

  it('事業所名と期間ラベルが正しく埋め込まれる', () => {
    const input = createMinimalInput({
      context: { periodLabel: '直近30日', facilityName: 'ひまわり園', audience: 'evening' },
    });
    const prompt = buildHandoffSummaryPrompt(input);
    expect(prompt).toContain('ひまわり園');
    expect(prompt).toContain('直近30日');
  });
});
