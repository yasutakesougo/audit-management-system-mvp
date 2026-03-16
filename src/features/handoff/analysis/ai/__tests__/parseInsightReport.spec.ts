/**
 * parseInsightReport テスト
 *
 * Pure Function なので外部依存なし。
 * JSON抽出、バリデーション、エッジケースをテストする。
 */

import { describe, it, expect } from 'vitest';
import { parseInsightReport, extractJsonFromResponse } from '../parseInsightReport';

const FIXED_DATE = '2026-03-16T12:00:00.000Z';

// ── extractJsonFromResponse ──

describe('extractJsonFromResponse', () => {
  it('```json ブロックからJSONを抽出する', () => {
    const input = '以下の結果です:\n```json\n{"summary":"テスト"}\n```\n以上です。';
    expect(extractJsonFromResponse(input)).toBe('{"summary":"テスト"}');
  });

  it('``` ブロック（言語指定なし）からJSONを抽出する', () => {
    const input = '```\n{"summary":"テスト"}\n```';
    expect(extractJsonFromResponse(input)).toBe('{"summary":"テスト"}');
  });

  it('直接JSONを抽出する', () => {
    const input = '結果: {"summary":"テスト","keyPoints":[]} 以上';
    expect(extractJsonFromResponse(input)).toBe('{"summary":"テスト","keyPoints":[]}');
  });

  it('ネストされたJSONを正しく抽出する', () => {
    const input = '{"summary":"テスト","userHighlights":[{"userDisplayName":"太郎","note":"注意"}]}';
    expect(extractJsonFromResponse(input)).toBe(input);
  });

  it('空文字列は空文字列を返す', () => {
    expect(extractJsonFromResponse('')).toBe('');
  });

  it('JSONが含まれない場合はトリムした文字列を返す', () => {
    expect(extractJsonFromResponse('  結果なし  ')).toBe('結果なし');
  });
});

// ── parseInsightReport ──

describe('parseInsightReport', () => {
  it('正常なJSONをパースできる', () => {
    const json = JSON.stringify({
      summary: 'テスト要約です',
      keyPoints: ['確認事項1', '確認事項2'],
      suggestedActions: ['アクション1'],
      userHighlights: [
        { userDisplayName: '田中太郎', note: '体調注意' },
      ],
    });

    const result = parseInsightReport(json, 'gpt-4o-mini', FIXED_DATE);
    expect(result).not.toBeNull();
    expect(result!.summary).toBe('テスト要約です');
    expect(result!.keyPoints).toEqual(['確認事項1', '確認事項2']);
    expect(result!.suggestedActions).toEqual(['アクション1']);
    expect(result!.userHighlights).toEqual([
      { userDisplayName: '田中太郎', note: '体調注意' },
    ]);
    expect(result!.meta).toEqual({
      generatedAt: FIXED_DATE,
      model: 'gpt-4o-mini',
      isAiGenerated: true,
    });
  });

  it('```json ブロック内のJSONをパースできる', () => {
    const input = `以下が結果です:
\`\`\`json
{
  "summary": "体調面に注意",
  "keyPoints": ["発熱が増加"],
  "suggestedActions": [],
  "userHighlights": []
}
\`\`\``;

    const result = parseInsightReport(input, 'gpt-4o-mini', FIXED_DATE);
    expect(result).not.toBeNull();
    expect(result!.summary).toBe('体調面に注意');
    expect(result!.keyPoints).toEqual(['発熱が増加']);
  });

  it('summary が200字超は切り詰められる', () => {
    const longSummary = 'あ'.repeat(300);
    const json = JSON.stringify({
      summary: longSummary,
      keyPoints: [],
    });

    const result = parseInsightReport(json, 'test', FIXED_DATE);
    expect(result).not.toBeNull();
    expect(result!.summary.length).toBe(200);
  });

  it('keyPoints が4件以上は3件に制限される', () => {
    const json = JSON.stringify({
      summary: 'テスト',
      keyPoints: ['A', 'B', 'C', 'D', 'E'],
    });

    const result = parseInsightReport(json, 'test', FIXED_DATE);
    expect(result).not.toBeNull();
    expect(result!.keyPoints).toHaveLength(3);
    expect(result!.keyPoints).toEqual(['A', 'B', 'C']);
  });

  it('suggestedActions が4件以上は3件に制限される', () => {
    const json = JSON.stringify({
      summary: 'テスト',
      keyPoints: [],
      suggestedActions: ['X', 'Y', 'Z', 'W'],
    });

    const result = parseInsightReport(json, 'test', FIXED_DATE);
    expect(result!.suggestedActions).toHaveLength(3);
  });

  it('userHighlights が6件以上は5件に制限される', () => {
    const highlights = Array.from({ length: 7 }, (_, i) => ({
      userDisplayName: `利用者${i}`,
      note: `メモ${i}`,
    }));
    const json = JSON.stringify({
      summary: 'テスト',
      keyPoints: [],
      userHighlights: highlights,
    });

    const result = parseInsightReport(json, 'test', FIXED_DATE);
    expect(result!.userHighlights).toHaveLength(5);
  });

  it('不正なJSONは null を返す', () => {
    expect(parseInsightReport('これはJSONではない', 'test', FIXED_DATE)).toBeNull();
  });

  it('空文字は null を返す', () => {
    expect(parseInsightReport('', 'test', FIXED_DATE)).toBeNull();
  });

  it('空白のみは null を返す', () => {
    expect(parseInsightReport('   ', 'test', FIXED_DATE)).toBeNull();
  });

  it('summary が空の場合は null を返す', () => {
    const json = JSON.stringify({ summary: '', keyPoints: [] });
    expect(parseInsightReport(json, 'test', FIXED_DATE)).toBeNull();
  });

  it('summary がない場合は null を返す', () => {
    const json = JSON.stringify({ keyPoints: ['aaa'] });
    expect(parseInsightReport(json, 'test', FIXED_DATE)).toBeNull();
  });

  it('keyPoints が配列でない場合は null を返す', () => {
    const json = JSON.stringify({ summary: 'テスト', keyPoints: '文字列' });
    expect(parseInsightReport(json, 'test', FIXED_DATE)).toBeNull();
  });

  it('suggestedActions が省略された場合は空配列になる', () => {
    const json = JSON.stringify({ summary: 'テスト', keyPoints: [] });
    const result = parseInsightReport(json, 'test', FIXED_DATE);
    expect(result!.suggestedActions).toEqual([]);
  });

  it('userHighlights が省略された場合は空配列になる', () => {
    const json = JSON.stringify({ summary: 'テスト', keyPoints: [] });
    const result = parseInsightReport(json, 'test', FIXED_DATE);
    expect(result!.userHighlights).toEqual([]);
  });

  it('keyPoints 内の空文字列はフィルタされる', () => {
    const json = JSON.stringify({
      summary: 'テスト',
      keyPoints: ['有効', '', '  ', '有効2'],
    });
    const result = parseInsightReport(json, 'test', FIXED_DATE);
    expect(result!.keyPoints).toEqual(['有効', '有効2']);
  });

  it('userHighlights の userDisplayName が空のものはフィルタされる', () => {
    const json = JSON.stringify({
      summary: 'テスト',
      keyPoints: [],
      userHighlights: [
        { userDisplayName: '太郎', note: 'OK' },
        { userDisplayName: '', note: 'NG' },
        { userDisplayName: '花子', note: '注意' },
      ],
    });
    const result = parseInsightReport(json, 'test', FIXED_DATE);
    expect(result!.userHighlights).toHaveLength(2);
    expect(result!.userHighlights[0].userDisplayName).toBe('太郎');
    expect(result!.userHighlights[1].userDisplayName).toBe('花子');
  });

  it('userHighlights の note が省略された場合は空文字になる', () => {
    const json = JSON.stringify({
      summary: 'テスト',
      keyPoints: [],
      userHighlights: [{ userDisplayName: '太郎' }],
    });
    const result = parseInsightReport(json, 'test', FIXED_DATE);
    expect(result!.userHighlights[0].note).toBe('');
  });

  it('model がメタデータに含まれる', () => {
    const json = JSON.stringify({ summary: 'テスト', keyPoints: [] });
    const result = parseInsightReport(json, 'gpt-4o-2024-05-13', FIXED_DATE);
    expect(result!.meta.model).toBe('gpt-4o-2024-05-13');
  });

  it('generatedAt を省略すると現在時刻がセットされる', () => {
    const json = JSON.stringify({ summary: 'テスト', keyPoints: [] });
    const result = parseInsightReport(json, 'test');
    expect(result!.meta.generatedAt).toBeTruthy();
    // ISO 形式であること
    expect(new Date(result!.meta.generatedAt).toISOString()).toBe(result!.meta.generatedAt);
  });
});
