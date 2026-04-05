/**
 * blockHandoffExtractor.spec.ts
 *
 * Block ベースの handoff 用セクション抽出テスト。
 *
 * 観点:
 * 1. prefix ベース抽出（【決定事項】【報告】【連絡事項】【継続検討】【次回予定】）
 * 2. block type ベース（checkListItem → actions）
 * 3. heading ベースのセクション分類
 * 4. 混在ケース
 * 5. fallback（分類不能 → summary）
 * 6. buildHandoffSections のハイブリッド fallback
 * 7. 空入力・エッジケース
 */
import { describe, expect, it } from 'vitest';
import {
  extractFromBlocks,
  buildHandoffSections,
  type ExtractedSections,
} from '../blockHandoffExtractor';
import type { MeetingMinuteBlock } from '../../types';

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

function makeBlock(
  type: string,
  text: string,
  props: Record<string, unknown> = {}
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
// 1. prefix ベース抽出
// ──────────────────────────────────────────────────────────────

describe('extractFromBlocks — prefix-based', () => {
  it('should extract 【決定事項】 into decisions', () => {
    const blocks = [p('【決定事項】来週から新制度を導入')];
    const result = extractFromBlocks(blocks);
    expect(result.decisions).toBe('来週から新制度を導入');
  });

  it('should extract 【報告】 into reports', () => {
    const blocks = [p('【報告】進捗は順調です')];
    const result = extractFromBlocks(blocks);
    expect(result.reports).toBe('進捗は順調です');
  });

  it('should extract 【連絡事項】 into notifications', () => {
    const blocks = [p('【連絡事項】来週月曜は休日です')];
    const result = extractFromBlocks(blocks);
    expect(result.notifications).toBe('来週月曜は休日です');
  });

  it('should extract 【継続検討】 into summary with tag', () => {
    const blocks = [p('【継続検討】予算配分について')];
    const result = extractFromBlocks(blocks);
    expect(result.summary).toContain('予算配分について');
    expect(result.summary).toContain('[継続検討]');
  });

  it('should extract 【次回予定】 into notifications with tag', () => {
    const blocks = [p('【次回予定】4/15 14:00')];
    const result = extractFromBlocks(blocks);
    expect(result.notifications).toContain('4/15 14:00');
    expect(result.notifications).toContain('[次回]');
  });

  it('should extract ■ 議題： into summary', () => {
    // 議題は heading なので heading 処理が先に走る
    // 実際にはテキストとしてsummary扱い
    const blocks2 = [p('■ 議題：新制度の導入')];
    const result = extractFromBlocks(blocks2);
    expect(result.summary).toContain('新制度の導入');
  });

  it('should handle multiple prefixed items', () => {
    const blocks = [
      p('【決定事項】予算承認'),
      p('【決定事項】人事異動の実施'),
      p('【報告】売上報告'),
    ];
    const result = extractFromBlocks(blocks);
    expect(result.decisions).toBe('予算承認\n人事異動の実施');
    expect(result.reports).toBe('売上報告');
  });
});

// ──────────────────────────────────────────────────────────────
// 2. formal block type ベース
// ──────────────────────────────────────────────────────────────

describe('extractFromBlocks — formal block type', () => {
  it('should extract decision block into decisions', () => {
    const blocks = [makeBlock('decision', '新しい方針を決定')];
    const result = extractFromBlocks(blocks);
    expect(result.decisions).toBe('新しい方針を決定');
  });

  it('should extract action block into actions', () => {
    const blocks = [makeBlock('action', '田中: 資料作成')];
    const result = extractFromBlocks(blocks);
    expect(result.actions).toBe('田中: 資料作成');
  });

  it('should extract report block into reports', () => {
    const blocks = [makeBlock('report', '進捗は順調です')];
    const result = extractFromBlocks(blocks);
    expect(result.reports).toBe('進捗は順調です');
  });

  it('should extract notification block into notifications', () => {
    const blocks = [makeBlock('notification', '来週月曜は休日です')];
    const result = extractFromBlocks(blocks);
    expect(result.notifications).toBe('来週月曜は休日です');
  });

  it('should extract multiple report blocks', () => {
    const blocks = [
      makeBlock('report', '売上報告'),
      makeBlock('report', '在庫報告'),
    ];
    const result = extractFromBlocks(blocks);
    expect(result.reports).toBe('売上報告\n在庫報告');
  });

  it('should extract multiple notification blocks', () => {
    const blocks = [
      makeBlock('notification', 'GW休業のお知らせ'),
      makeBlock('notification', '社内研修の案内'),
    ];
    const result = extractFromBlocks(blocks);
    expect(result.notifications).toBe('GW休業のお知らせ\n社内研修の案内');
  });

  it('should extract nextSchedule block into notifications with tag', () => {
    const blocks = [makeBlock('nextSchedule', '次回は5/1')];
    const result = extractFromBlocks(blocks);
    expect(result.notifications).toBe('[次回] 次回は5/1');
  });

  it('should extract continuingDiscussion block into summary with tag', () => {
    const blocks = [makeBlock('continuingDiscussion', '予算の件')];
    const result = extractFromBlocks(blocks);
    expect(result.summary).toBe('[継続検討] 予算の件');
  });

  it('formal block type should override prefix if both exist for same category', () => {
    const blocks = [
      p('【決定事項】古い決定'),
      makeBlock('decision', '新しい決定'),
    ];
    const result = extractFromBlocks(blocks);
    expect(result.decisions).toContain('古い決定');
    expect(result.decisions).toContain('新しい決定');
  });

  it('formal report block and prefix report should coexist', () => {
    const blocks = [
      p('【報告】prefix報告'),
      makeBlock('report', 'formal報告'),
    ];
    const result = extractFromBlocks(blocks);
    expect(result.reports).toContain('prefix報告');
    expect(result.reports).toContain('formal報告');
  });

  it('formal notification block and prefix notice should coexist', () => {
    const blocks = [
      p('【連絡事項】prefix連絡'),
      makeBlock('notification', 'formal連絡'),
    ];
    const result = extractFromBlocks(blocks);
    expect(result.notifications).toContain('prefix連絡');
    expect(result.notifications).toContain('formal連絡');
  });
});

// ──────────────────────────────────────────────────────────────
// 3. block type (legacy checkListItem) ベース
// ──────────────────────────────────────────────────────────────

describe('extractFromBlocks — block type (legacy)', () => {
  it('should extract checkListItem into actions', () => {
    const blocks = [
      check('山田: レポート提出'),
      check('鈴木: 見積もり作成', true),
    ];
    const result = extractFromBlocks(blocks);
    expect(result.actions).toBe('山田: レポート提出\n鈴木: 見積もり作成');
  });

  it('should not include empty checkListItems', () => {
    const blocks = [check(''), check('実際のタスク')];
    const result = extractFromBlocks(blocks);
    expect(result.actions).toBe('実際のタスク');
  });
});

// ──────────────────────────────────────────────────────────────
// 3. heading ベースのセクション分類
// ──────────────────────────────────────────────────────────────

describe('extractFromBlocks — heading-based sections', () => {
  it('should classify blocks under 決定事項 heading', () => {
    const blocks = [
      h('決定事項'),
      p('新制度を導入する'),
      p('予算は500万とする'),
    ];
    const result = extractFromBlocks(blocks);
    expect(result.decisions).toBe('新制度を導入する\n予算は500万とする');
  });

  it('should switch sections at next heading', () => {
    const blocks = [
      h('報告'),
      p('進捗報告'),
      h('アクション'),
      p('タスクA'),
    ];
    const result = extractFromBlocks(blocks);
    expect(result.reports).toBe('進捗報告');
    expect(result.actions).toBe('タスクA');
  });

  it('should handle 要点 heading', () => {
    const blocks = [
      h('要点'),
      p('会議の主要ポイント'),
    ];
    const result = extractFromBlocks(blocks);
    expect(result.summary).toBe('会議の主要ポイント');
  });

  it('should handle 連絡 heading', () => {
    const blocks = [
      h('連絡事項'),
      p('全体ミーティングあり'),
    ];
    const result = extractFromBlocks(blocks);
    expect(result.notifications).toBe('全体ミーティングあり');
  });
});

// ──────────────────────────────────────────────────────────────
// 4. 混在ケース
// ──────────────────────────────────────────────────────────────

describe('extractFromBlocks — mixed content', () => {
  it('should handle prefix + heading + checkList mixed', () => {
    const blocks = [
      h('要点'),
      p('今月の目標確認'),
      p('【決定事項】新システム導入'),
      check('山田: 資料作成'),
      h('連絡'),
      p('来週金曜は研修日'),
      p('【報告】先月の売上は前年比110%'),
    ];

    const result = extractFromBlocks(blocks);
    expect(result.summary).toBe('今月の目標確認');
    expect(result.decisions).toBe('新システム導入');
    expect(result.actions).toBe('山田: 資料作成');
    expect(result.notifications).toBe('来週金曜は研修日');
    expect(result.reports).toBe('先月の売上は前年比110%');
  });

  it('should handle real-world meeting structure', () => {
    const blocks = [
      h('■ 議題：4月職員会議'),
      p('出席者: 10名'),
      h('報告'),
      p('3月の利用者状況について報告'),
      h('決定事項'),
      p('4月から新シフト制を導入'),
      p('利用者Aの支援計画を更新'),
      check('佐藤: シフト表作成'),
      check('田中: 支援計画ドラフト'),
      p('【連絡事項】GW期間の出勤について'),
      p('【次回予定】5/1 14:00'),
    ];

    const result = extractFromBlocks(blocks);
    expect(result.summary).toContain('出席者: 10名');
    expect(result.reports).toContain('3月の利用者状況');
    expect(result.decisions).toContain('新シフト制を導入');
    expect(result.decisions).toContain('支援計画を更新');
    expect(result.actions).toContain('佐藤: シフト表作成');
    expect(result.actions).toContain('田中: 支援計画ドラフト');
    expect(result.notifications).toContain('GW期間の出勤');
    expect(result.notifications).toContain('5/1 14:00');
  });
});

// ──────────────────────────────────────────────────────────────
// 5. fallback（分類不能 → summary）
// ──────────────────────────────────────────────────────────────

describe('extractFromBlocks — fallback', () => {
  it('should put unclassified paragraphs into summary', () => {
    const blocks = [
      p('会議は予定通り開催された'),
      p('特に問題なし'),
    ];
    const result = extractFromBlocks(blocks);
    expect(result.summary).toBe('会議は予定通り開催された\n特に問題なし');
    expect(result.decisions).toBe('');
    expect(result.actions).toBe('');
  });

  it('should return empty sections for empty blocks', () => {
    const result = extractFromBlocks([]);
    const empty: ExtractedSections = {
      summary: '',
      decisions: '',
      actions: '',
      reports: '',
      notifications: '',
    };
    expect(result).toEqual(empty);
  });
});

// ──────────────────────────────────────────────────────────────
// 6. buildHandoffSections — ハイブリッド fallback
// ──────────────────────────────────────────────────────────────

describe('buildHandoffSections', () => {
  const legacy = {
    summary: 'legacy要点',
    decisions: 'legacy決定事項',
    actions: 'legacyアクション',
  };

  it('should use legacy when contentBlocks is undefined', () => {
    const result = buildHandoffSections(undefined, legacy);
    expect(result.summary).toBe('legacy要点');
    expect(result.decisions).toBe('legacy決定事項');
    expect(result.actions).toBe('legacyアクション');
    expect(result.reports).toBe('');
    expect(result.notifications).toBe('');
  });

  it('should use legacy when contentBlocks is empty array', () => {
    const result = buildHandoffSections([], legacy);
    expect(result.summary).toBe('legacy要点');
    expect(result.decisions).toBe('legacy決定事項');
    expect(result.actions).toBe('legacyアクション');
  });

  it('should prefer block extraction when contentBlocks exist', () => {
    const blocks = [
      p('【決定事項】block決定事項'),
      check('blockアクション'),
    ];
    const result = buildHandoffSections(blocks, legacy);
    expect(result.decisions).toBe('block決定事項');
    expect(result.actions).toBe('blockアクション');
  });

  it('should fall back to legacy for empty extracted fields', () => {
    // blocks に決定事項もアクションもない → legacy で補完
    const blocks = [
      p('ブロックの要点テキスト'),
    ];
    const result = buildHandoffSections(blocks, legacy);
    expect(result.summary).toBe('ブロックの要点テキスト');
    expect(result.decisions).toBe('legacy決定事項'); // block から抽出できなかった
    expect(result.actions).toBe('legacyアクション');  // block から抽出できなかった
  });

  it('should include reports and notifications from blocks', () => {
    const blocks = [
      p('【報告】block報告'),
      p('【連絡事項】block連絡'),
    ];
    const result = buildHandoffSections(blocks, legacy);
    expect(result.reports).toBe('block報告');
    expect(result.notifications).toBe('block連絡');
    // summary は block から抽出できないので legacy で補完
    expect(result.summary).toBe('legacy要点');
  });

  it('should handle hybrid: some from blocks, some from legacy', () => {
    const blocks = [
      h('決定事項'),
      p('新制度導入'),
      // actions は block にない
    ];
    const result = buildHandoffSections(blocks, legacy);
    expect(result.decisions).toBe('新制度導入'); // block
    expect(result.actions).toBe('legacyアクション'); // legacy fallback
    expect(result.summary).toBe('legacy要点'); // legacy fallback
  });
});
