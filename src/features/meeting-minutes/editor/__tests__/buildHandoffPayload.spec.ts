/**
 * buildHandoffPayload.spec.ts
 *
 * handoff payload 組み立てロジックの単体テスト。
 *
 * 観点:
 * 1. セクション選択に応じた条件付き結合
 * 2. 表示順序（要約→報告→決定事項→アクション→連絡事項→追記）
 * 3. 空セクションのスキップ
 * 4. 未選択セクションの除外
 * 5. legacy fallback との互換性
 * 6. block ベースの抽出との統合
 * 7. 新旧混在データでの安定性
 */
import { describe, expect, it } from 'vitest';
import {
  buildHandoffPayloadFromSections,
  buildHandoffPayload,
  type HandoffSectionSelection,
} from '../buildHandoffPayload';
import { HANDOFF_TEMPLATES } from '../handoffTemplates';
import type { ExtractedSections } from '../blockHandoffExtractor';
import type { MeetingMinuteBlock } from '../../types';

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

const defaultMeta = {
  category: '職員会議',
  meetingDate: '2026-04-01',
  minutesId: 42,
};

const fullSections: ExtractedSections = {
  summary: '会議の要点です',
  decisions: '新制度を導入する',
  actions: '田中: 資料作成',
  reports: '売上は前年比110%',
  notifications: 'GW期間の出勤について',
};

const emptySections: ExtractedSections = {
  summary: '',
  decisions: '',
  actions: '',
  reports: '',
  notifications: '',
};

const allSelected: HandoffSectionSelection = {
  includeSummary: true,
  includeDecisions: true,
  includeActions: true,
  includeReports: true,
  includeNotifications: true,
};

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

// ──────────────────────────────────────────────────────────────
// 1. 全セクション選択時
// ──────────────────────────────────────────────────────────────

describe('buildHandoffPayloadFromSections — all selected', () => {
  it('should include all sections when all are selected and non-empty', () => {
    const result = buildHandoffPayloadFromSections(fullSections, allSelected, defaultMeta);

    expect(result.body).toContain('■要点');
    expect(result.body).toContain('会議の要点です');
    expect(result.body).toContain('■報告');
    expect(result.body).toContain('売上は前年比110%');
    expect(result.body).toContain('■決定事項');
    expect(result.body).toContain('新制度を導入する');
    expect(result.body).toContain('■アクション');
    expect(result.body).toContain('田中: 資料作成');
    expect(result.body).toContain('■連絡事項');
    expect(result.body).toContain('GW期間の出勤について');
  });

  it('should generate correct title', () => {
    const result = buildHandoffPayloadFromSections(fullSections, allSelected, defaultMeta);
    expect(result.title).toBe('【職員会議】2026-04-01');
  });

  it('should generate correct sourceUrl', () => {
    const result = buildHandoffPayloadFromSections(fullSections, allSelected, defaultMeta);
    expect(result.sourceUrl).toBe('/meeting-minutes/42');
  });

  it('should include header label', () => {
    const result = buildHandoffPayloadFromSections(fullSections, allSelected, defaultMeta);
    expect(result.body).toContain('【職員会議（2026-04-01）】');
  });

  it('should include source link', () => {
    const result = buildHandoffPayloadFromSections(fullSections, allSelected, defaultMeta);
    expect(result.body).toContain('元議事録: /meeting-minutes/42');
  });
});

// ──────────────────────────────────────────────────────────────
// 2. セクション選択の制御
// ──────────────────────────────────────────────────────────────

describe('buildHandoffPayloadFromSections — selective inclusion', () => {
  it('should exclude summary when not selected', () => {
    const result = buildHandoffPayloadFromSections(fullSections, {
      ...allSelected,
      includeSummary: false,
    }, defaultMeta);

    expect(result.body).not.toContain('■要点');
    expect(result.body).not.toContain('会議の要点です');
    expect(result.body).toContain('■決定事項'); // others still included
  });

  it('should exclude reports when not selected', () => {
    const result = buildHandoffPayloadFromSections(fullSections, {
      ...allSelected,
      includeReports: false,
    }, defaultMeta);

    expect(result.body).not.toContain('■報告');
    expect(result.body).not.toContain('売上は前年比110%');
  });

  it('should exclude notifications when not selected', () => {
    const result = buildHandoffPayloadFromSections(fullSections, {
      ...allSelected,
      includeNotifications: false,
    }, defaultMeta);

    expect(result.body).not.toContain('■連絡事項');
    expect(result.body).not.toContain('GW期間の出勤について');
  });

  it('should exclude decisions when not selected', () => {
    const result = buildHandoffPayloadFromSections(fullSections, {
      ...allSelected,
      includeDecisions: false,
    }, defaultMeta);

    expect(result.body).not.toContain('■決定事項');
    expect(result.body).not.toContain('新制度を導入する');
  });

  it('should exclude actions when not selected', () => {
    const result = buildHandoffPayloadFromSections(fullSections, {
      ...allSelected,
      includeActions: false,
    }, defaultMeta);

    expect(result.body).not.toContain('■アクション');
    expect(result.body).not.toContain('田中: 資料作成');
  });

  it('should only include summary when only summary is selected', () => {
    const result = buildHandoffPayloadFromSections(fullSections, {
      includeSummary: true,
      includeDecisions: false,
      includeActions: false,
      includeReports: false,
      includeNotifications: false,
    }, defaultMeta);

    expect(result.body).toContain('■要点');
    expect(result.body).not.toContain('■報告');
    expect(result.body).not.toContain('■決定事項');
    expect(result.body).not.toContain('■アクション');
    expect(result.body).not.toContain('■連絡事項');
  });
});

// ──────────────────────────────────────────────────────────────
// 3. 空セクションのスキップ
// ──────────────────────────────────────────────────────────────

describe('buildHandoffPayloadFromSections — empty sections', () => {
  it('should not include empty sections even when selected', () => {
    const result = buildHandoffPayloadFromSections(emptySections, allSelected, defaultMeta);

    expect(result.body).not.toContain('■要点');
    expect(result.body).not.toContain('■報告');
    expect(result.body).not.toContain('■決定事項');
    expect(result.body).not.toContain('■アクション');
    expect(result.body).not.toContain('■連絡事項');
  });

  it('should skip empty reports/notifications but include non-empty sections', () => {
    const sections: ExtractedSections = {
      summary: '概要あり',
      decisions: '決定あり',
      actions: '',
      reports: '',
      notifications: '',
    };
    const result = buildHandoffPayloadFromSections(sections, allSelected, defaultMeta);

    expect(result.body).toContain('■要点');
    expect(result.body).toContain('■決定事項');
    expect(result.body).not.toContain('■報告');
    expect(result.body).not.toContain('■アクション');
    expect(result.body).not.toContain('■連絡事項');
  });
});

// ──────────────────────────────────────────────────────────────
// 4. 表示順序の検証
// ──────────────────────────────────────────────────────────────

describe('buildHandoffPayloadFromSections — section ordering', () => {
  it('should maintain default order: 要点 → 報告 → 決定事項 → アクション → 連絡事項', () => {
    const result = buildHandoffPayloadFromSections(fullSections, allSelected, defaultMeta);

    const summaryIdx = result.body.indexOf('■要点');
    const reportIdx = result.body.indexOf('■報告');
    const decisionIdx = result.body.indexOf('■決定事項');
    const actionIdx = result.body.indexOf('■アクション');
    const notificationIdx = result.body.indexOf('■連絡事項');

    expect(summaryIdx).toBeLessThan(reportIdx);
    expect(reportIdx).toBeLessThan(decisionIdx);
    expect(decisionIdx).toBeLessThan(actionIdx);
    expect(actionIdx).toBeLessThan(notificationIdx);
  });

  it('should use field template order: アクション → 連絡事項 → 決定事項 → 報告 → 要点', () => {
    const result = buildHandoffPayloadFromSections(fullSections, {
      ...allSelected,
      sectionOrder: HANDOFF_TEMPLATES.field.sectionOrder,
    }, defaultMeta);

    const actionIdx = result.body.indexOf('■アクション');
    const notificationIdx = result.body.indexOf('■連絡事項');
    const decisionIdx = result.body.indexOf('■決定事項');
    const reportIdx = result.body.indexOf('■報告');
    const summaryIdx = result.body.indexOf('■要点');

    expect(actionIdx).toBeLessThan(notificationIdx);
    expect(notificationIdx).toBeLessThan(decisionIdx);
    expect(decisionIdx).toBeLessThan(reportIdx);
    expect(reportIdx).toBeLessThan(summaryIdx);
  });

  it('should use admin template order: 要点 → 報告 → 決定事項 → アクション → 連絡事項', () => {
    const result = buildHandoffPayloadFromSections(fullSections, {
      ...allSelected,
      sectionOrder: HANDOFF_TEMPLATES.admin.sectionOrder,
    }, defaultMeta);

    const summaryIdx = result.body.indexOf('■要点');
    const reportIdx = result.body.indexOf('■報告');
    const decisionIdx = result.body.indexOf('■決定事項');
    const actionIdx = result.body.indexOf('■アクション');
    const notificationIdx = result.body.indexOf('■連絡事項');

    expect(summaryIdx).toBeLessThan(reportIdx);
    expect(reportIdx).toBeLessThan(decisionIdx);
    expect(decisionIdx).toBeLessThan(actionIdx);
    expect(actionIdx).toBeLessThan(notificationIdx);
  });
});

// ──────────────────────────────────────────────────────────────
// formatting presets (audience)
// ──────────────────────────────────────────────────────────────

describe('buildHandoffPayloadFromSections — audience formatting', () => {
  it('should use default headings when audience is not specified', () => {
    const result = buildHandoffPayloadFromSections(fullSections, allSelected, defaultMeta);
    expect(result.body).toContain('■要点');
    expect(result.body).toContain('■アクション');
  });

  it('should use field formatting when audience is field', () => {
    const result = buildHandoffPayloadFromSections(fullSections, {
      ...allSelected,
      audience: 'field',
    }, defaultMeta);
    
    expect(result.body).toContain('【🔥 現場申し送り】');
    expect(result.body).toContain('📝 要点メモ');
    expect(result.body).toContain('📌 【対応】アクション');
  });

  it('should use admin formatting when audience is admin', () => {
    const result = buildHandoffPayloadFromSections(fullSections, {
      ...allSelected,
      audience: 'admin',
    }, defaultMeta);
    
    expect(result.body).toContain('【🏛 管理者共有用レポート】');
    expect(result.body).toContain('📄 【要約】議事録エグゼクティブサマリ');
    expect(result.body).toContain('📌 【Next】アクション');
  });
});

// ──────────────────────────────────────────────────────────────
// 5. 追記テキスト
// ──────────────────────────────────────────────────────────────

describe('buildHandoffPayloadFromSections — extra text', () => {
  it('should include extra text when provided', () => {
    const result = buildHandoffPayloadFromSections(fullSections, {
      ...allSelected,
      extraText: '追加のメモです',
    }, defaultMeta);

    expect(result.body).toContain('■追記');
    expect(result.body).toContain('追加のメモです');
  });

  it('should not include extra text when empty', () => {
    const result = buildHandoffPayloadFromSections(fullSections, {
      ...allSelected,
      extraText: '',
    }, defaultMeta);

    expect(result.body).not.toContain('■追記');
  });

  it('should not include extra text when whitespace only', () => {
    const result = buildHandoffPayloadFromSections(fullSections, {
      ...allSelected,
      extraText: '   ',
    }, defaultMeta);

    expect(result.body).not.toContain('■追記');
  });

  it('should trim extra text', () => {
    const result = buildHandoffPayloadFromSections(fullSections, {
      ...allSelected,
      extraText: '  trimmed text  ',
    }, defaultMeta);

    expect(result.body).toContain('trimmed text');
    // Should not have leading/trailing spaces in the text part
    expect(result.body).toContain('■追記\ntrimmed text');
  });

  it('extra text should appear after all sections', () => {
    const result = buildHandoffPayloadFromSections(fullSections, {
      ...allSelected,
      extraText: '最後のメモ',
    }, defaultMeta);

    const lastSectionIdx = result.body.indexOf('■連絡事項');
    const extraIdx = result.body.indexOf('■追記');
    expect(extraIdx).toBeGreaterThan(lastSectionIdx);
  });
});

// ──────────────────────────────────────────────────────────────
// 6. includeReports / includeNotifications optional behavior
// ──────────────────────────────────────────────────────────────

describe('buildHandoffPayloadFromSections — optional flags', () => {
  it('should not include reports when includeReports is undefined', () => {
    const result = buildHandoffPayloadFromSections(fullSections, {
      includeSummary: true,
      includeDecisions: true,
      includeActions: true,
      // includeReports not set → undefined → falsy
    }, defaultMeta);

    expect(result.body).not.toContain('■報告');
  });

  it('should not include notifications when includeNotifications is undefined', () => {
    const result = buildHandoffPayloadFromSections(fullSections, {
      includeSummary: true,
      includeDecisions: true,
      includeActions: true,
      // includeNotifications not set → undefined → falsy
    }, defaultMeta);

    expect(result.body).not.toContain('■連絡事項');
  });
});

// ──────────────────────────────────────────────────────────────
// 7. buildHandoffPayload — integration with extractor
// ──────────────────────────────────────────────────────────────

describe('buildHandoffPayload — legacy fallback', () => {
  it('should use legacy fields when no contentBlocks', () => {
    const result = buildHandoffPayload({
      id: 1,
      category: '朝会',
      meetingDate: '2026-04-01',
      summary: 'legacy要点',
      decisions: 'legacy決定事項',
      actions: 'legacyアクション',
      contentBlocks: undefined,
    }, allSelected);

    expect(result.body).toContain('legacy要点');
    expect(result.body).toContain('legacy決定事項');
    expect(result.body).toContain('legacyアクション');
    expect(result.body).not.toContain('■報告'); // no blocks → no reports
    expect(result.body).not.toContain('■連絡事項'); // no blocks → no notifications
  });

  it('should use legacy fields when contentBlocks is empty', () => {
    const result = buildHandoffPayload({
      id: 1,
      category: '朝会',
      meetingDate: '2026-04-01',
      summary: 'legacy要点',
      decisions: 'legacy決定',
      actions: 'legacyアクション',
      contentBlocks: [],
    }, allSelected);

    expect(result.body).toContain('legacy要点');
    expect(result.body).toContain('legacy決定');
  });
});

describe('buildHandoffPayload — block-based extraction', () => {
  it('should extract formal report/notification blocks', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeBlock('report', '売上報告の内容'),
      makeBlock('notification', '来週の予定について'),
      makeBlock('decision', '新制度導入'),
      makeBlock('action', '田中: 資料準備'),
    ];

    const result = buildHandoffPayload({
      id: 5,
      category: '職員会議',
      meetingDate: '2026-04-05',
      summary: '',
      decisions: '',
      actions: '',
      contentBlocks: blocks,
    }, allSelected);

    expect(result.body).toContain('■報告');
    expect(result.body).toContain('売上報告の内容');
    expect(result.body).toContain('■連絡事項');
    expect(result.body).toContain('来週の予定について');
    expect(result.body).toContain('■決定事項');
    expect(result.body).toContain('新制度導入');
    expect(result.body).toContain('■アクション');
    expect(result.body).toContain('田中: 資料準備');
  });

  it('should extract prefix-based legacy data from blocks', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeBlock('paragraph', '【報告】prefix報告内容'),
      makeBlock('paragraph', '【連絡事項】prefix連絡内容'),
      makeBlock('paragraph', '【決定事項】prefix決定事項'),
    ];

    const result = buildHandoffPayload({
      id: 6,
      category: '夕会',
      meetingDate: '2026-04-05',
      summary: '',
      decisions: '',
      actions: '',
      contentBlocks: blocks,
    }, allSelected);

    expect(result.body).toContain('prefix報告内容');
    expect(result.body).toContain('prefix連絡内容');
    expect(result.body).toContain('prefix決定事項');
  });

  it('should handle mixed formal blocks and prefix data', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeBlock('report', 'formal報告'),
      makeBlock('paragraph', '【報告】prefix報告'),
      makeBlock('notification', 'formal連絡'),
      makeBlock('paragraph', '【連絡事項】prefix連絡'),
    ];

    const result = buildHandoffPayload({
      id: 7,
      category: '職員会議',
      meetingDate: '2026-04-05',
      summary: '',
      decisions: '',
      actions: '',
      contentBlocks: blocks,
    }, allSelected);

    expect(result.body).toContain('formal報告');
    expect(result.body).toContain('prefix報告');
    expect(result.body).toContain('formal連絡');
    expect(result.body).toContain('prefix連絡');
  });
});

// ──────────────────────────────────────────────────────────────
// 8. backward compatibility
// ──────────────────────────────────────────────────────────────

describe('buildHandoffPayload — backward compatibility', () => {
  it('should work with only summary/decisions/actions (legacy pattern)', () => {
    const result = buildHandoffPayload({
      id: 10,
      category: '朝会',
      meetingDate: '2026-03-01',
      summary: '今日の要点',
      decisions: '決定A',
      actions: 'アクションB',
      contentBlocks: undefined,
    }, {
      includeSummary: true,
      includeDecisions: true,
      includeActions: true,
      // no includeReports / includeNotifications
    });

    expect(result.body).toContain('今日の要点');
    expect(result.body).toContain('決定A');
    expect(result.body).toContain('アクションB');
    expect(result.title).toBe('【朝会】2026-03-01');
    expect(result.sourceUrl).toBe('/meeting-minutes/10');
  });

  it('should not crash when decision/action blocks exist alongside report/notification', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeBlock('decision', '決定内容'),
      makeBlock('action', 'アクション内容'),
      makeBlock('report', '報告内容'),
      makeBlock('notification', '連絡内容'),
    ];

    const result = buildHandoffPayload({
      id: 11,
      category: '職員会議',
      meetingDate: '2026-04-01',
      summary: '',
      decisions: '',
      actions: '',
      contentBlocks: blocks,
    }, allSelected);

    expect(result.body).toContain('決定内容');
    expect(result.body).toContain('アクション内容');
    expect(result.body).toContain('報告内容');
    expect(result.body).toContain('連絡内容');
  });

  it('should work with legacy hybrid: blocks have some, legacy has rest', () => {
    const blocks: MeetingMinuteBlock[] = [
      makeBlock('decision', 'block決定事項'),
    ];

    const result = buildHandoffPayload({
      id: 12,
      category: '朝会',
      meetingDate: '2026-04-01',
      summary: 'legacy要点',
      decisions: 'legacy決定（上書きされる）',
      actions: 'legacyアクション',
      contentBlocks: blocks,
    }, allSelected);

    // block から decision が取れるのでそちらが優先
    expect(result.body).toContain('block決定事項');
    // block に actions がないので legacy fallback
    expect(result.body).toContain('legacyアクション');
    // block に summary がないので legacy fallback
    expect(result.body).toContain('legacy要点');
  });
});
