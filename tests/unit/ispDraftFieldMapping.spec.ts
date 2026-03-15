/**
 * @fileoverview ispDraftFieldMapping のユニットテスト
 * @description
 * Phase 5-D3:
 *   - DRAFT_SECTION_TO_FIELD のマッピング網羅テスト
 *   - extractApplicableSections の正常系テスト
 *   - buildDraftFieldMap の正常系テスト
 */
import { describe, it, expect } from 'vitest';
import type { IspPlanDraft, IspPlanDraftSectionKind } from '@/features/monitoring/domain/ispPlanDraftTypes';
import {
  DRAFT_SECTION_TO_FIELD,
  DRAFT_SECTION_TARGET_LABELS,
  extractApplicableSections,
  buildDraftFieldMap,
} from '@/features/monitoring/domain/ispDraftFieldMapping';

// ─── テストヘルパー ─────────────────────────────────────

function createTestDraft(): IspPlanDraft {
  return {
    sections: [
      { kind: 'overview', title: '期間概要', lines: ['期間: 2025/04 〜 2026/03'] },
      { kind: 'monitoring-findings', title: 'モニタリング所見', lines: ['所見行1', '所見行2'] },
      { kind: 'goal-assessment', title: '目標別評価', lines: ['目標評価行1'] },
      { kind: 'decision-summary', title: '判断結果まとめ', lines: ['判断行1', '判断行2', '判断行3'] },
      { kind: 'plan-revision', title: '計画見直し案', lines: ['見直し行1'] },
      { kind: 'next-actions', title: '次期アクション', lines: ['アクション行1', 'アクション行2'] },
    ],
  };
}

// ─── DRAFT_SECTION_TO_FIELD ──────────────────────────────

describe('DRAFT_SECTION_TO_FIELD', () => {
  it('overview は null（転記対象外）', () => {
    expect(DRAFT_SECTION_TO_FIELD['overview']).toBeNull();
  });

  it('monitoring-findings → monitoringPlan', () => {
    expect(DRAFT_SECTION_TO_FIELD['monitoring-findings']).toBe('monitoringPlan');
  });

  it('goal-assessment → assessmentSummary', () => {
    expect(DRAFT_SECTION_TO_FIELD['goal-assessment']).toBe('assessmentSummary');
  });

  it('decision-summary → conferenceNotes', () => {
    expect(DRAFT_SECTION_TO_FIELD['decision-summary']).toBe('conferenceNotes');
  });

  it('plan-revision → reviewTiming', () => {
    expect(DRAFT_SECTION_TO_FIELD['plan-revision']).toBe('reviewTiming');
  });

  it('next-actions → improvementIdeas', () => {
    expect(DRAFT_SECTION_TO_FIELD['next-actions']).toBe('improvementIdeas');
  });

  it('全6セクション種別をカバーしている', () => {
    const allKinds: IspPlanDraftSectionKind[] = [
      'overview', 'monitoring-findings', 'goal-assessment',
      'decision-summary', 'plan-revision', 'next-actions',
    ];
    for (const kind of allKinds) {
      expect(kind in DRAFT_SECTION_TO_FIELD).toBe(true);
    }
  });
});

// ─── DRAFT_SECTION_TARGET_LABELS ─────────────────────────

describe('DRAFT_SECTION_TARGET_LABELS', () => {
  it('overview は null（ラベル不要）', () => {
    expect(DRAFT_SECTION_TARGET_LABELS['overview']).toBeNull();
  });

  it('転記対象セクションは日本語ラベルを持つ', () => {
    const targetKinds: IspPlanDraftSectionKind[] = [
      'monitoring-findings', 'goal-assessment',
      'decision-summary', 'plan-revision', 'next-actions',
    ];
    for (const kind of targetKinds) {
      expect(typeof DRAFT_SECTION_TARGET_LABELS[kind]).toBe('string');
      expect((DRAFT_SECTION_TARGET_LABELS[kind] as string).length).toBeGreaterThan(0);
    }
  });
});

// ─── extractApplicableSections ───────────────────────────

describe('extractApplicableSections', () => {
  it('overview を除外して5セクションを返す', () => {
    const draft = createTestDraft();
    const result = extractApplicableSections(draft);
    expect(result).toHaveLength(5);
    expect(result.map((r) => r.kind)).not.toContain('overview');
  });

  it('各セクションに targetField / targetLabel / text が正しく設定される', () => {
    const draft = createTestDraft();
    const result = extractApplicableSections(draft);

    const monitoringSection = result.find((r) => r.kind === 'monitoring-findings');
    expect(monitoringSection).toBeDefined();
    expect(monitoringSection!.targetField).toBe('monitoringPlan');
    expect(monitoringSection!.targetLabel).toBe('モニタリング手法');
    expect(monitoringSection!.text).toBe('所見行1\n所見行2');
  });

  it('セクションが空のドラフトでは空配列を返す', () => {
    const draft: IspPlanDraft = { sections: [] };
    const result = extractApplicableSections(draft);
    expect(result).toHaveLength(0);
  });

  it('overview のみのドラフトでは空配列を返す', () => {
    const draft: IspPlanDraft = {
      sections: [
        { kind: 'overview', title: '期間概要', lines: ['テスト'] },
      ],
    };
    const result = extractApplicableSections(draft);
    expect(result).toHaveLength(0);
  });
});

// ─── buildDraftFieldMap ──────────────────────────────────

describe('buildDraftFieldMap', () => {
  it('5フィールド分のマップを返す', () => {
    const draft = createTestDraft();
    const map = buildDraftFieldMap(draft);
    expect(Object.keys(map)).toHaveLength(5);
  });

  it('monitoringPlan に monitoring-findings の内容が入る', () => {
    const draft = createTestDraft();
    const map = buildDraftFieldMap(draft);
    expect(map.monitoringPlan).toBe('所見行1\n所見行2');
  });

  it('assessmentSummary に goal-assessment の内容が入る', () => {
    const draft = createTestDraft();
    const map = buildDraftFieldMap(draft);
    expect(map.assessmentSummary).toBe('目標評価行1');
  });

  it('conferenceNotes に decision-summary の内容が入る', () => {
    const draft = createTestDraft();
    const map = buildDraftFieldMap(draft);
    expect(map.conferenceNotes).toBe('判断行1\n判断行2\n判断行3');
  });

  it('reviewTiming に plan-revision の内容が入る', () => {
    const draft = createTestDraft();
    const map = buildDraftFieldMap(draft);
    expect(map.reviewTiming).toBe('見直し行1');
  });

  it('improvementIdeas に next-actions の内容が入る', () => {
    const draft = createTestDraft();
    const map = buildDraftFieldMap(draft);
    expect(map.improvementIdeas).toBe('アクション行1\nアクション行2');
  });

  it('空のドラフトでは空オブジェクトを返す', () => {
    const draft: IspPlanDraft = { sections: [] };
    const map = buildDraftFieldMap(draft);
    expect(Object.keys(map)).toHaveLength(0);
  });
});
