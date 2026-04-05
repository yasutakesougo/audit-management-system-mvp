/**
 * blockNormalizer.spec.ts
 *
 * Block 正規化レイヤーの単体テスト。
 *
 * 観点:
 * 1. undefined / null / 空配列に安全に対応する
 * 2. formal block はそのまま維持される
 * 3. prefix paragraph は壊れない
 * 4. checkListItem block は壊れない
 * 5. 未知 block type は pass-through される
 * 6. nested structure があれば維持される
 * 7. 不正 shape は安全に補完される
 * 8. normalize(normalize(x)) === normalize(x) を保証する（冪等性）
 * 9. handoff 互換: normalize 前後で extractFromBlocks の結果が変わらない
 */
import { describe, expect, it } from 'vitest';
import {
  normalizeMeetingMinuteBlocks,
  normalizeMeetingMinuteBlock,
} from '../blockNormalizer';
import { extractFromBlocks, buildHandoffSections } from '../blockHandoffExtractor';
import type { MeetingMinuteBlock } from '../../types';

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function makeBlock(
  type: string,
  text: string,
  props: Record<string, unknown> = {},
): MeetingMinuteBlock {
  return {
    id: `t-${Math.random().toString(36).slice(2)}`,
    type,
    props,
    content: [{ type: 'text', text, styles: {} }],
    children: [],
  };
}

const p = (text: string) => makeBlock('paragraph', text);
const h = (text: string, level = 2) => makeBlock('heading', text, { level });
const check = (text: string, checked = false) =>
  makeBlock('checkListItem', text, { checked });

// ──────────────────────────────────────────────────────────────
// 1. null / undefined / 空配列
// ──────────────────────────────────────────────────────────────

describe('normalizeMeetingMinuteBlocks — null/undefined/empty', () => {
  it('should return [] for undefined', () => {
    expect(normalizeMeetingMinuteBlocks(undefined)).toEqual([]);
  });

  it('should return [] for null', () => {
    expect(normalizeMeetingMinuteBlocks(null)).toEqual([]);
  });

  it('should return [] for empty array', () => {
    expect(normalizeMeetingMinuteBlocks([])).toEqual([]);
  });

  it('should filter out null/undefined entries in array', () => {
    const input = [p('valid'), null, undefined, p('also valid')] as unknown as MeetingMinuteBlock[];
    const result = normalizeMeetingMinuteBlocks(input);
    expect(result).toHaveLength(2);
    expect(result[0].type).toBe('paragraph');
    expect(result[1].type).toBe('paragraph');
  });
});

// ──────────────────────────────────────────────────────────────
// 2. formal block の維持
// ──────────────────────────────────────────────────────────────

describe('normalizeMeetingMinuteBlocks — formal blocks', () => {
  it('should preserve decision blocks as-is', () => {
    const blocks = [makeBlock('decision', '新方針を決定')];
    const result = normalizeMeetingMinuteBlocks(blocks);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('decision');
    expect(result[0].content).toEqual([{ type: 'text', text: '新方針を決定', styles: {} }]);
  });

  it('should preserve action blocks as-is', () => {
    const blocks = [makeBlock('action', '田中: 資料作成')];
    const result = normalizeMeetingMinuteBlocks(blocks);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('action');
    expect(result[0].content).toEqual([{ type: 'text', text: '田中: 資料作成', styles: {} }]);
  });

  it('should preserve report blocks as-is', () => {
    const blocks = [makeBlock('report', '進捗は順調です')];
    const result = normalizeMeetingMinuteBlocks(blocks);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('report');
    expect(result[0].content).toEqual([{ type: 'text', text: '進捗は順調です', styles: {} }]);
  });

  it('should preserve notification blocks as-is', () => {
    const blocks = [makeBlock('notification', '来週月曜は休日です')];
    const result = normalizeMeetingMinuteBlocks(blocks);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('notification');
    expect(result[0].content).toEqual([{ type: 'text', text: '来週月曜は休日です', styles: {} }]);
  });
});

// ──────────────────────────────────────────────────────────────
// 3. prefix paragraph の維持
// ──────────────────────────────────────────────────────────────

describe('normalizeMeetingMinuteBlocks — prefix paragraphs', () => {
  it('should preserve 【決定事項】 prefix paragraph intact', () => {
    const blocks = [p('【決定事項】来週から新制度を導入')];
    const result = normalizeMeetingMinuteBlocks(blocks);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('paragraph');
    expect(result[0].content).toEqual([
      { type: 'text', text: '【決定事項】来週から新制度を導入', styles: {} },
    ]);
  });

  it('should preserve 【報告】 prefix paragraph intact', () => {
    const blocks = [p('【報告】進捗は順調です')];
    const result = normalizeMeetingMinuteBlocks(blocks);
    expect(result[0].content).toEqual([
      { type: 'text', text: '【報告】進捗は順調です', styles: {} },
    ]);
  });

  it('should preserve 【連絡事項】 prefix paragraph intact', () => {
    const blocks = [p('【連絡事項】来週月曜は休日です')];
    const result = normalizeMeetingMinuteBlocks(blocks);
    expect(result[0].content).toEqual([
      { type: 'text', text: '【連絡事項】来週月曜は休日です', styles: {} },
    ]);
  });

  it('should preserve 【継続検討】 prefix paragraph intact', () => {
    const blocks = [p('【継続検討】予算配分について')];
    const result = normalizeMeetingMinuteBlocks(blocks);
    expect(result[0].content).toEqual([
      { type: 'text', text: '【継続検討】予算配分について', styles: {} },
    ]);
  });

  it('should preserve 【次回予定】 prefix paragraph intact', () => {
    const blocks = [p('【次回予定】4/15 14:00')];
    const result = normalizeMeetingMinuteBlocks(blocks);
    expect(result[0].content).toEqual([
      { type: 'text', text: '【次回予定】4/15 14:00', styles: {} },
    ]);
  });
});

// ──────────────────────────────────────────────────────────────
// 4. checkListItem の維持
// ──────────────────────────────────────────────────────────────

describe('normalizeMeetingMinuteBlocks — checkListItem', () => {
  it('should preserve checkListItem props (checked=false)', () => {
    const blocks = [check('タスクA', false)];
    const result = normalizeMeetingMinuteBlocks(blocks);
    expect(result[0].type).toBe('checkListItem');
    expect(result[0].props).toEqual({ checked: false });
  });

  it('should preserve checkListItem props (checked=true)', () => {
    const blocks = [check('完了タスク', true)];
    const result = normalizeMeetingMinuteBlocks(blocks);
    expect(result[0].type).toBe('checkListItem');
    expect(result[0].props).toEqual({ checked: true });
  });
});

// ──────────────────────────────────────────────────────────────
// 5. 未知 block type の pass-through
// ──────────────────────────────────────────────────────────────

describe('normalizeMeetingMinuteBlocks — unknown block types', () => {
  it('should pass-through unknown block types without modification', () => {
    const blocks = [makeBlock('customWidget', 'カスタムコンテンツ', { foo: 42 })];
    const result = normalizeMeetingMinuteBlocks(blocks);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('customWidget');
    expect(result[0].props).toEqual({ foo: 42 });
    expect(result[0].content).toEqual([{ type: 'text', text: 'カスタムコンテンツ', styles: {} }]);
  });

  it('should not destroy or convert unknown types', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeBlock('image', '', { url: 'https://example.com/img.png' }),
      makeBlock('table', '', { rows: 3 }),
    ];
    const result = normalizeMeetingMinuteBlocks(blocks);
    expect(result[0].type).toBe('image');
    expect(result[1].type).toBe('table');
  });
});

// ──────────────────────────────────────────────────────────────
// 6. nested structure (children) の維持
// ──────────────────────────────────────────────────────────────

describe('normalizeMeetingMinuteBlocks — nested children', () => {
  it('should recursively normalize children', () => {
    const blocks: MeetingMinuteBlock[] = [{
      id: 'parent',
      type: 'bulletListItem',
      props: {},
      content: [{ type: 'text', text: '親項目', styles: {} }],
      children: [
        {
          id: 'child-1',
          type: 'paragraph',
          props: {},
          content: [{ type: 'text', text: '子項目', styles: {} }],
          children: [],
        },
      ],
    }];
    const result = normalizeMeetingMinuteBlocks(blocks);
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children![0].type).toBe('paragraph');
    expect(result[0].children![0].content).toEqual([
      { type: 'text', text: '子項目', styles: {} },
    ]);
  });

  it('should normalize children with missing fields', () => {
    const blocks: MeetingMinuteBlock[] = [{
      id: 'parent',
      type: 'bulletListItem',
      props: {},
      content: [],
      children: [
        // child with missing fields
        { type: 'paragraph' } as unknown as MeetingMinuteBlock,
      ],
    }];
    const result = normalizeMeetingMinuteBlocks(blocks);
    expect(result[0].children).toHaveLength(1);
    const child = result[0].children![0];
    expect(child.id).toBe('');
    expect(child.type).toBe('paragraph');
    expect(child.props).toEqual({});
    expect(child.content).toEqual([]);
    expect(child.children).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────
// 7. 不正 shape の安全な補完
// ──────────────────────────────────────────────────────────────

describe('normalizeMeetingMinuteBlocks — malformed data', () => {
  it('should fill in missing id with empty string', () => {
    const block = { type: 'paragraph', props: {}, content: [] } as unknown as MeetingMinuteBlock;
    const result = normalizeMeetingMinuteBlocks([block]);
    expect(result[0].id).toBe('');
  });

  it('should default empty type to paragraph', () => {
    const block = { id: 'x', type: '', props: {} } as unknown as MeetingMinuteBlock;
    const result = normalizeMeetingMinuteBlocks([block]);
    expect(result[0].type).toBe('paragraph');
  });

  it('should default missing type to paragraph', () => {
    const block = { id: 'x', props: {} } as unknown as MeetingMinuteBlock;
    const result = normalizeMeetingMinuteBlocks([block]);
    expect(result[0].type).toBe('paragraph');
  });

  it('should default missing props to empty object', () => {
    const block = { id: 'x', type: 'paragraph' } as unknown as MeetingMinuteBlock;
    const result = normalizeMeetingMinuteBlocks([block]);
    expect(result[0].props).toEqual({});
  });

  it('should default non-array content to empty array', () => {
    const block = {
      id: 'x',
      type: 'paragraph',
      props: {},
      content: 'not-an-array',
    } as unknown as MeetingMinuteBlock;
    const result = normalizeMeetingMinuteBlocks([block]);
    expect(result[0].content).toEqual([]);
  });

  it('should default non-array children to empty array', () => {
    const block = {
      id: 'x',
      type: 'paragraph',
      props: {},
      content: [],
      children: 'not-an-array',
    } as unknown as MeetingMinuteBlock;
    const result = normalizeMeetingMinuteBlocks([block]);
    expect(result[0].children).toEqual([]);
  });

  it('should handle non-array input gracefully', () => {
    const result = normalizeMeetingMinuteBlocks(
      'not-an-array' as unknown as MeetingMinuteBlock[],
    );
    expect(result).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────
// 8. 冪等性
// ──────────────────────────────────────────────────────────────

describe('normalizeMeetingMinuteBlocks — idempotency', () => {
  it('normalize(normalize(x)) should deeply equal normalize(x) for simple blocks', () => {
    const blocks = [
      p('テスト'),
      h('見出し'),
      check('タスク'),
      makeBlock('decision', '決定事項'),
      makeBlock('action', 'アクション'),
      makeBlock('report', '報告事項'),
      makeBlock('notification', '連絡事項'),
    ];
    const once = normalizeMeetingMinuteBlocks(blocks);
    const twice = normalizeMeetingMinuteBlocks(once);
    expect(twice).toEqual(once);
  });

  it('normalize(normalize(x)) should deeply equal normalize(x) for prefix blocks', () => {
    const blocks = [
      p('【決定事項】新制度導入'),
      p('【報告】進捗報告'),
      p('【連絡事項】連絡です'),
      p('【継続検討】要検討'),
      p('【次回予定】4/15'),
    ];
    const once = normalizeMeetingMinuteBlocks(blocks);
    const twice = normalizeMeetingMinuteBlocks(once);
    expect(twice).toEqual(once);
  });

  it('normalize(normalize(x)) should deeply equal normalize(x) for malformed blocks', () => {
    const blocks = [
      { type: 'paragraph' } as unknown as MeetingMinuteBlock,
      { id: 'x' } as unknown as MeetingMinuteBlock,
      { id: '1', type: 'decision', props: {}, content: 'bad' } as unknown as MeetingMinuteBlock,
    ];
    const once = normalizeMeetingMinuteBlocks(blocks);
    const twice = normalizeMeetingMinuteBlocks(once);
    expect(twice).toEqual(once);
  });

  it('normalize(normalize(x)) should deeply equal normalize(x) for nested blocks', () => {
    const blocks: MeetingMinuteBlock[] = [{
      id: 'parent',
      type: 'bulletListItem',
      props: {},
      content: [{ type: 'text', text: '親', styles: {} }],
      children: [
        { type: 'paragraph' } as unknown as MeetingMinuteBlock,
      ],
    }];
    const once = normalizeMeetingMinuteBlocks(blocks);
    const twice = normalizeMeetingMinuteBlocks(once);
    expect(twice).toEqual(once);
  });

  it('normalize(normalize(x)) should deeply equal normalize(x) for mixed content', () => {
    const blocks: MeetingMinuteBlock[] = [
      h('要点'),
      p('会議の概要'),
      p('【決定事項】新制度導入'),
      makeBlock('decision', '正式決定'),
      check('田中: 資料作成'),
      makeBlock('action', '佐藤: 見積もり'),
      p('【報告】売上報告'),
      makeBlock('unknownType', '未知のブロック', { custom: true }),
    ];
    const once = normalizeMeetingMinuteBlocks(blocks);
    const twice = normalizeMeetingMinuteBlocks(once);
    expect(twice).toEqual(once);
  });
});

// ──────────────────────────────────────────────────────────────
// 9. handoff 互換性: normalize 前後で抽出結果が安定する
// ──────────────────────────────────────────────────────────────

describe('normalizeMeetingMinuteBlocks — handoff compatibility', () => {
  it('extractFromBlocks should produce same result with normalized input', () => {
    const blocks = [
      p('【決定事項】予算承認'),
      p('【報告】売上報告'),
      check('山田: レポート提出'),
      makeBlock('decision', '正式決定'),
      makeBlock('action', '佐藤: 対応'),
    ];

    const beforeNormalize = extractFromBlocks(blocks);
    const normalized = normalizeMeetingMinuteBlocks(blocks);
    const afterNormalize = extractFromBlocks(normalized);

    expect(afterNormalize).toEqual(beforeNormalize);
  });

  it('extractFromBlocks should produce same result for heading-based sections', () => {
    const blocks = [
      h('決定事項'),
      p('新制度を導入する'),
      h('アクション'),
      p('タスクA'),
    ];

    const beforeNormalize = extractFromBlocks(blocks);
    const normalized = normalizeMeetingMinuteBlocks(blocks);
    const afterNormalize = extractFromBlocks(normalized);

    expect(afterNormalize).toEqual(beforeNormalize);
  });

  it('extractFromBlocks should produce same result for mixed formal + prefix + checklist', () => {
    const blocks = [
      h('要点'),
      p('今月の目標確認'),
      p('【決定事項】新システム導入'),
      check('山田: 資料作成'),
      makeBlock('decision', '正式決定A'),
      makeBlock('action', '正式アクションB'),
      makeBlock('report', '正式報告C'),
      makeBlock('notification', '正式連絡D'),
      h('連絡'),
      p('来週金曜は研修日'),
      p('【報告】先月の売上は前年比110%'),
    ];

    const beforeNormalize = extractFromBlocks(blocks);
    const normalized = normalizeMeetingMinuteBlocks(blocks);
    const afterNormalize = extractFromBlocks(normalized);

    expect(afterNormalize).toEqual(beforeNormalize);
  });

  it('buildHandoffSections should work correctly with legacy fallback after normalize', () => {
    const legacy = {
      summary: 'legacy要点',
      decisions: 'legacy決定事項',
      actions: 'legacyアクション',
    };

    // blocks なし → 完全 legacy
    expect(buildHandoffSections(undefined, legacy).summary).toBe('legacy要点');
    expect(buildHandoffSections([], legacy).decisions).toBe('legacy決定事項');

    // blocks あり → block 優先
    const blocks = [p('【決定事項】block決定事項')];
    const result = buildHandoffSections(blocks, legacy);
    expect(result.decisions).toBe('block決定事項');
    expect(result.actions).toBe('legacyアクション'); // block にないので legacy fallback
  });

  it('should not break extraction for empty blocks after normalize', () => {
    const result = extractFromBlocks([]);
    expect(result.summary).toBe('');
    expect(result.decisions).toBe('');
    expect(result.actions).toBe('');
    expect(result.reports).toBe('');
    expect(result.notifications).toBe('');
  });
});

// ──────────────────────────────────────────────────────────────
// 10. normalizeMeetingMinuteBlock (単一 block 用)
// ──────────────────────────────────────────────────────────────

describe('normalizeMeetingMinuteBlock — single block', () => {
  it('should normalize a well-formed block without changes', () => {
    const block = p('テスト');
    const result = normalizeMeetingMinuteBlock(block);
    expect(result.type).toBe('paragraph');
    expect(result.content).toEqual(block.content);
    expect(result.children).toEqual([]);
  });

  it('should produce a safe fallback for non-object input', () => {
    const result = normalizeMeetingMinuteBlock(null as unknown as MeetingMinuteBlock);
    expect(result.id).toBe('');
    expect(result.type).toBe('paragraph');
    expect(result.props).toEqual({});
    expect(result.content).toEqual([]);
    expect(result.children).toEqual([]);
  });
});
