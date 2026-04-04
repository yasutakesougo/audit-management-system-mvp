/**
 * blockMappers.spec.ts
 *
 * ブロックエディタ ↔ レガシーテキストフィールドの変換ユーティリティのテスト。
 *
 * 観点:
 * 1. legacy fields → blocks 変換（セクション見出し付き）
 * 2. blocks → summary テキスト抽出
 * 3. blocks → decisions テキスト抽出
 * 4. blocks → actions テキスト抽出
 * 5. 空入力への耐性
 * 6. セクション見出しなしブロックの fallback
 */
import { describe, expect, it } from 'vitest';
import {
  buildFallbackBlocksFromLegacyFields,
  buildSummaryText,
  buildDecisionsText,
  buildActionsText,
  blocksToPlainText,
} from '../blockMappers';
import type { MeetingMinuteBlock } from '../../types';

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function makeTextBlock(
  text: string,
  type = 'paragraph',
  props: Record<string, unknown> = {}
): MeetingMinuteBlock {
  return {
    id: `test-${Math.random().toString(36).slice(2)}`,
    type,
    props,
    content: [{ type: 'text', text, styles: {} }],
    children: [],
  };
}

function makeHeadingBlock(text: string, level = 2): MeetingMinuteBlock {
  return makeTextBlock(text, 'heading', { level });
}

// ──────────────────────────────────────────────────────────────
// 1. buildFallbackBlocksFromLegacyFields
// ──────────────────────────────────────────────────────────────

describe('buildFallbackBlocksFromLegacyFields', () => {
  it('should create blocks with section headings from legacy fields', () => {
    const blocks = buildFallbackBlocksFromLegacyFields({
      summary: '要点テキスト',
      decisions: '決定事項テキスト',
      actions: 'アクションテキスト',
    });

    // 各セクションに見出し+本文 = 2ブロック × 3セクション = 6ブロック
    expect(blocks.length).toBe(6);

    // 見出しをチェック
    expect(blocks[0].type).toBe('heading');
    expect(blocks[2].type).toBe('heading');
    expect(blocks[4].type).toBe('heading');
  });

  it('should skip empty sections', () => {
    const blocks = buildFallbackBlocksFromLegacyFields({
      summary: '要点だけ',
      decisions: '',
      actions: '',
    });

    // summary の見出し + 本文 = 2 ブロック
    expect(blocks.length).toBe(2);
    expect(blocks[0].type).toBe('heading');
    expect(blocks[1].type).toBe('paragraph');
  });

  it('should return empty array when all fields are empty', () => {
    const blocks = buildFallbackBlocksFromLegacyFields({
      summary: '',
      decisions: '',
      actions: '',
    });
    expect(blocks).toEqual([]);
  });

  it('should handle multiline text correctly', () => {
    const blocks = buildFallbackBlocksFromLegacyFields({
      summary: '行1\n行2\n行3',
      decisions: '',
      actions: '',
    });

    // 見出し(1) + 3行のパラグラフ(3) = 4 ブロック
    expect(blocks.length).toBe(4);
  });

  it('should handle whitespace-only fields as empty', () => {
    const blocks = buildFallbackBlocksFromLegacyFields({
      summary: '   ',
      decisions: '\n\n',
      actions: '\t',
    });
    expect(blocks).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────
// 2. buildSummaryText
// ──────────────────────────────────────────────────────────────

describe('buildSummaryText', () => {
  it('should extract text under 要点 heading', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeHeadingBlock('要点'),
      makeTextBlock('今月の目標を確認'),
      makeTextBlock('来月の計画を立案'),
      makeHeadingBlock('決定事項'),
      makeTextBlock('何かを決めた'),
    ];

    expect(buildSummaryText(blocks)).toBe('今月の目標を確認\n来月の計画を立案');
  });

  it('should extract text under Summary heading (English)', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeHeadingBlock('Summary'),
      makeTextBlock('English summary text'),
    ];
    expect(buildSummaryText(blocks)).toBe('English summary text');
  });

  it('should return all text as fallback when no section heading exists', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeTextBlock('フリーテキスト1'),
      makeTextBlock('フリーテキスト2'),
    ];
    expect(buildSummaryText(blocks)).toBe('フリーテキスト1\nフリーテキスト2');
  });

  it('should return empty string for empty blocks', () => {
    expect(buildSummaryText([])).toBe('');
  });
});

// ──────────────────────────────────────────────────────────────
// 3. buildDecisionsText
// ──────────────────────────────────────────────────────────────

describe('buildDecisionsText', () => {
  it('should extract text under 決定事項 heading', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeHeadingBlock('要点'),
      makeTextBlock('要点テキスト'),
      makeHeadingBlock('決定事項'),
      makeTextBlock('○○を実施する'),
      makeTextBlock('△△を中止する'),
      makeHeadingBlock('アクション'),
      makeTextBlock('アクションテキスト'),
    ];

    expect(buildDecisionsText(blocks)).toBe('○○を実施する\n△△を中止する');
  });

  it('should return empty string when 決定事項 heading is not found', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeTextBlock('フリーテキスト'),
    ];
    expect(buildDecisionsText(blocks)).toBe('');
  });

  it('should extract text from decision formal block types', () => {
    const blocks: MeetingMinuteBlock[] = [
      {
        id: '1',
        type: 'decision',
        props: {},
        content: [{ type: 'text', text: '新しい方針を決定', styles: {} }],
        children: [],
      },
    ];
    expect(buildDecisionsText(blocks)).toBe('新しい方針を決定');
  });
});

// ──────────────────────────────────────────────────────────────
// 4. buildActionsText
// ──────────────────────────────────────────────────────────────

describe('buildActionsText', () => {
  it('should extract text under アクション heading', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeHeadingBlock('決定事項'),
      makeTextBlock('決定事項テキスト'),
      makeHeadingBlock('アクション'),
      makeTextBlock('山田: レポート提出'),
    ];

    expect(buildActionsText(blocks)).toBe('山田: レポート提出');
  });

  it('should extract text under Actions heading (English)', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeHeadingBlock('Actions'),
      makeTextBlock('Task 1'),
      makeTextBlock('Task 2'),
    ];
    expect(buildActionsText(blocks)).toBe('Task 1\nTask 2');
  });

  it('should extract text from action formal block types', () => {
    const blocks: MeetingMinuteBlock[] = [
      {
        id: '1',
        type: 'action',
        props: {},
        content: [{ type: 'text', text: '山田: レポート提出', styles: {} }],
        children: [],
      },
    ];
    expect(buildActionsText(blocks)).toBe('山田: レポート提出');
  });
});

// ──────────────────────────────────────────────────────────────
// 5. blocksToPlainText
// ──────────────────────────────────────────────────────────────

describe('blocksToPlainText', () => {
  it('should concatenate all block texts with newlines', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeHeadingBlock('タイトル'),
      makeTextBlock('本文1'),
      makeTextBlock('本文2'),
    ];
    expect(blocksToPlainText(blocks)).toBe('タイトル\n本文1\n本文2');
  });

  it('should return empty string for empty blocks', () => {
    expect(blocksToPlainText([])).toBe('');
  });

  it('should handle blocks with empty content', () => {
    const block: MeetingMinuteBlock = {
      id: 'test-empty',
      type: 'paragraph',
      props: {},
      content: [],
      children: [],
    };
    expect(blocksToPlainText([block])).toBe('');
  });
});

// ──────────────────────────────────────────────────────────────
// 6. ラウンドトリップ: legacy → blocks → legacy
// ──────────────────────────────────────────────────────────────

describe('round-trip: legacy → blocks → legacy', () => {
  it('should preserve summary after round-trip conversion', () => {
    const original = {
      summary: '会議の要点を確認',
      decisions: '来週から新制度を開始',
      actions: '担当: 山田',
    };

    const blocks = buildFallbackBlocksFromLegacyFields(original);
    const restored = buildSummaryText(blocks);

    expect(restored).toBe(original.summary);
  });

  it('should preserve decisions after round-trip conversion', () => {
    const original = {
      summary: '要点',
      decisions: '決定事項テスト',
      actions: 'アクションテスト',
    };

    const blocks = buildFallbackBlocksFromLegacyFields(original);
    const restored = buildDecisionsText(blocks);

    expect(restored).toBe(original.decisions);
  });

  it('should preserve actions after round-trip conversion', () => {
    const original = {
      summary: '要点',
      decisions: '決定事項',
      actions: '担当: 鈴木 / 期限: 4/15',
    };

    const blocks = buildFallbackBlocksFromLegacyFields(original);
    const restored = buildActionsText(blocks);

    expect(restored).toBe(original.actions);
  });
});

// ──────────────────────────────────────────────────────────────
// 7. prefix ベースの抽出（新 Slash メニュー対応）
// ──────────────────────────────────────────────────────────────

describe('prefix-based extraction', () => {
  it('should extract decisions from 【決定事項】prefixed paragraphs', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeTextBlock('会議の冒頭あいさつ'),
      makeTextBlock('【決定事項】来月から新制度を導入する'),
      makeTextBlock('【決定事項】予算上限を500万に設定'),
      makeTextBlock('その他の議論'),
    ];

    expect(buildDecisionsText(blocks)).toBe(
      '来月から新制度を導入する\n予算上限を500万に設定'
    );
  });

  it('should prefer section heading over prefix when both exist', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeHeadingBlock('決定事項'),
      makeTextBlock('見出しベースの決定事項'),
      makeHeadingBlock('その他'),
      makeTextBlock('【決定事項】prefix ベースは無視される'),
    ];

    // 見出しベースが優先される
    expect(buildDecisionsText(blocks)).toBe('見出しベースの決定事項');
  });

  it('should return empty when no decisions exist in any form', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeTextBlock('普通のテキスト'),
    ];
    expect(buildDecisionsText(blocks)).toBe('');
  });
});

// ──────────────────────────────────────────────────────────────
// 8. checkListItem ベースのアクション抽出
// ──────────────────────────────────────────────────────────────

describe('checkListItem-based action extraction', () => {
  function makeCheckItem(text: string, checked = false): MeetingMinuteBlock {
    return {
      id: `test-${Math.random().toString(36).slice(2)}`,
      type: 'checkListItem',
      props: { checked },
      content: [{ type: 'text', text, styles: {} }],
      children: [],
    };
  }

  it('should extract actions from checkListItem blocks', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeTextBlock('会議の冒頭'),
      makeCheckItem('山田: レポート提出'),
      makeCheckItem('鈴木: 見積もり作成'),
      makeTextBlock('閉会'),
    ];

    expect(buildActionsText(blocks)).toBe(
      '山田: レポート提出\n鈴木: 見積もり作成'
    );
  });

  it('should prefer section heading over checkListItem', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeHeadingBlock('アクション'),
      makeTextBlock('見出し配下のアクション'),
      makeHeadingBlock('その他'),
      makeCheckItem('チェックリストの項目'),
    ];

    // 見出しベースが優先される
    expect(buildActionsText(blocks)).toBe('見出し配下のアクション');
  });

  it('should return empty string when no actions in any form', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeTextBlock('普通のテキスト'),
    ];
    expect(buildActionsText(blocks)).toBe('');
  });
});
