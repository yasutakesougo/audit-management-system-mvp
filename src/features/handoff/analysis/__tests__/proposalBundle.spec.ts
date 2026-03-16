/**
 * proposalBundle.spec.ts — 統一提案バンドルのユニットテスト
 */
import { describe, expect, it } from 'vitest';
import {
  adaptReviewProposal,
  adaptAbcComparison,
  adaptRevisionDraft,
  buildProposalPreview,
  buildAdoptionRecords,
} from '../proposalBundle';
import type { ReviewProposal } from '../buildReviewProposal';
import type { AbcPatternComparison } from '../compareAbcPatternPeriods';
import type { RevisionDraft } from '../evaluateGoalProgress';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function makeReviewProposal(): ReviewProposal {
  return {
    userCode: 'U001',
    userDisplayName: '田中太郎',
    urgency: 'recommended',
    riskScore: 45,
    actions: [
      { fieldKey: 'targetBehavior', fieldLabel: '対象行動', section: '§2 対象行動', actionType: 'review', suggestion: '行動の見直し', evidenceSummary: 'アラート検出' },
      { fieldKey: 'preSupport', fieldLabel: '事前支援', section: '§5 予防的支援', actionType: 'review', suggestion: '事前支援の確認', evidenceSummary: '環境変化' },
    ],
    summary: '田中太郎さんの見直しを推奨',
    sourceEvidence: {
      riskLevel: 'high',
      score: 45,
      alertLabels: ['alert-1', 'alert-2'],
      patternSummaries: ['行動変化'],
    },
    generatedAt: '2026-03-16T12:00:00.000Z',
  };
}

function makeAbcComparison(): AbcPatternComparison {
  return {
    previousCount: 10,
    currentCount: 15,
    settingChanges: [],
    newSettings: ['入浴場面'],
    disappearedSettings: ['移動場面'],
    significantIncreases: [
      { setting: '食事場面', changeType: 'increased', previousCount: 3, currentCount: 8, previousRatio: 0.3, currentRatio: 0.53, changeRate: 1.67 },
    ],
    significantDecreases: [],
    intensityShift: {
      previous: { low: 5, medium: 3, high: 2 },
      current: { low: 3, medium: 4, high: 8 },
      highRateDelta: 0.33,
      riskRateDelta: 0.2,
      worsening: true,
    },
    alerts: [
      { type: 'new_scene', severity: 'warning', setting: '入浴場面', message: '新出', suggestion: '確認' },
      { type: 'scene_spike', severity: 'alert', setting: '食事場面', message: '急増', suggestion: '見直し' },
    ],
    overallChangeLevel: 'significant',
  };
}

function makeRevisionDraft(): RevisionDraft {
  return {
    userId: 'U001',
    planningSheetId: 'ps-001',
    revisionLevel: 'adjust',
    items: [
      { fieldKey: 'preSupport', fieldLabel: '事前支援', section: '§5 予防的支援', changeType: 'modify', currentValue: '既存の支援', proposedValue: '【調整】支援変更', reason: '一部有効' },
      { fieldKey: 'triggers', fieldLabel: 'トリガー', section: '§3 氷山分析', changeType: 'add', currentValue: '', proposedValue: '【新規トリガー】大きな音', reason: '新発見' },
      { fieldKey: 'preSupport', fieldLabel: '事前支援', section: '§5 予防的支援', changeType: 'keep', currentValue: '環境調整A', proposedValue: '環境調整A', reason: '有効 — 継続' },
    ],
    summary: 'モニタリング結果に基づく改定ドラフト（部分調整）: 2件の変更提案',
    monitoringPeriod: { start: '2026-02-01', end: '2026-02-28' },
    generatedAt: '2026-03-16T12:00:00.000Z',
  };
}

// ────────────────────────────────────────────────────────────
// adaptReviewProposal
// ────────────────────────────────────────────────────────────

describe('adaptReviewProposal', () => {
  it('ReviewProposal を共通バンドルに変換', () => {
    const bundle = adaptReviewProposal(makeReviewProposal());

    expect(bundle.source).toBe('handoff');
    expect(bundle.userCode).toBe('U001');
    expect(bundle.urgency).toBe('recommended');
    expect(bundle.fieldProposals).toHaveLength(2);
    expect(bundle.fieldProposals[0].fieldKey).toBe('targetBehavior');
    expect(bundle.provenance.sourceType).toBe('handoff');
  });
});

// ────────────────────────────────────────────────────────────
// adaptAbcComparison
// ────────────────────────────────────────────────────────────

describe('adaptAbcComparison', () => {
  it('AbcPatternComparison を共通バンドルに変換', () => {
    const bundle = adaptAbcComparison(makeAbcComparison(), 'U001', '田中太郎');

    expect(bundle.source).toBe('abc');
    expect(bundle.urgency).toBe('urgent');
    expect(bundle.fieldProposals.length).toBeGreaterThanOrEqual(3); // new + spike + worsening + disappeared
  });

  it('新出場面 → 環境調整の append 提案', () => {
    const bundle = adaptAbcComparison(makeAbcComparison(), 'U001');
    const envProposal = bundle.fieldProposals.find(p => p.fieldKey === 'environmentalAdjustment');
    expect(envProposal).toBeDefined();
    expect(envProposal!.action).toBe('append');
    expect(envProposal!.proposedValue).toContain('入浴場面');
  });

  it('強度悪化 → 危機対応の replace 提案', () => {
    const bundle = adaptAbcComparison(makeAbcComparison(), 'U001');
    const crisisProposal = bundle.fieldProposals.find(p => p.fieldKey === 'emergencyResponse');
    expect(crisisProposal).toBeDefined();
    expect(crisisProposal!.action).toBe('replace');
  });

  it('消失場面 → モニタリング指標へ成功事例', () => {
    const bundle = adaptAbcComparison(makeAbcComparison(), 'U001');
    const successProposal = bundle.fieldProposals.find(p => p.proposedValue.includes('成功事例'));
    expect(successProposal).toBeDefined();
    expect(successProposal!.sectionKey).toContain('§9');
  });
});

// ────────────────────────────────────────────────────────────
// adaptRevisionDraft
// ────────────────────────────────────────────────────────────

describe('adaptRevisionDraft', () => {
  it('RevisionDraft を共通バンドルに変換', () => {
    const bundle = adaptRevisionDraft(makeRevisionDraft(), '田中太郎');

    expect(bundle.source).toBe('monitoring');
    expect(bundle.urgency).toBe('recommended');
    expect(bundle.fieldProposals).toHaveLength(3);
  });

  it('changeType → action のマッピングが正しい', () => {
    const bundle = adaptRevisionDraft(makeRevisionDraft());
    const actions = bundle.fieldProposals.map(p => p.action);
    expect(actions).toContain('replace'); // modify → replace
    expect(actions).toContain('add');
    expect(actions).toContain('keep');
  });

  it('revise → urgent にマッピング', () => {
    const draft = makeRevisionDraft();
    draft.revisionLevel = 'revise';
    const bundle = adaptRevisionDraft(draft);
    expect(bundle.urgency).toBe('urgent');
  });
});

// ────────────────────────────────────────────────────────────
// buildProposalPreview
// ────────────────────────────────────────────────────────────

describe('buildProposalPreview', () => {
  it('3系統のバンドルを統一プレビューに変換', () => {
    const bundles = [
      adaptReviewProposal(makeReviewProposal()),
      adaptAbcComparison(makeAbcComparison(), 'U001'),
      adaptRevisionDraft(makeRevisionDraft()),
    ];

    const preview = buildProposalPreview(bundles);

    expect(preview.items.length).toBeGreaterThan(0);
    expect(preview.summary.bySource.handoff).toBeGreaterThan(0);
    expect(preview.summary.bySource.abc).toBeGreaterThan(0);
    expect(preview.summary.bySource.monitoring).toBeGreaterThan(0);
  });

  it('セクション順でソート', () => {
    const bundles = [adaptReviewProposal(makeReviewProposal())];
    const preview = buildProposalPreview(bundles);

    for (let i = 1; i < preview.items.length; i++) {
      expect(
        preview.items[i].sectionKey.localeCompare(preview.items[i - 1].sectionKey, 'ja'),
      ).toBeGreaterThanOrEqual(0);
    }
  });

  it('keep はデフォルトで selected=false', () => {
    const bundles = [adaptRevisionDraft(makeRevisionDraft())];
    const preview = buildProposalPreview(bundles);
    const keepItems = preview.items.filter(i => i.action === 'keep');
    expect(keepItems.every(i => !i.selected)).toBe(true);
  });

  it('keep 以外はデフォルトで selected=true', () => {
    const bundles = [adaptRevisionDraft(makeRevisionDraft())];
    const preview = buildProposalPreview(bundles);
    const nonKeepItems = preview.items.filter(i => i.action !== 'keep');
    expect(nonKeepItems.every(i => i.selected)).toBe(true);
  });

  it('空バンドル → 空プレビュー', () => {
    const preview = buildProposalPreview([]);
    expect(preview.items).toHaveLength(0);
    expect(preview.summary.totalProposals).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────
// buildAdoptionRecords
// ────────────────────────────────────────────────────────────

describe('buildAdoptionRecords', () => {
  it('選択された項目から採用記録を生成', () => {
    const bundles = [adaptReviewProposal(makeReviewProposal())];
    const preview = buildProposalPreview(bundles);
    const baseDate = new Date('2026-03-16T15:00:00Z');

    const records = buildAdoptionRecords(preview.items, '鈴木', baseDate);

    expect(records.length).toBeGreaterThan(0);
    expect(records[0].adoptedBy).toBe('鈴木');
    expect(records[0].adoptedAt).toBe('2026-03-16T15:00:00.000Z');
    expect(records[0].source).toBe('handoff');
  });

  it('keep は採用記録に含まない', () => {
    const bundles = [adaptRevisionDraft(makeRevisionDraft())];
    const preview = buildProposalPreview(bundles);
    const records = buildAdoptionRecords(preview.items, '鈴木');

    const keepRecords = records.filter(r => r.proposedValue.includes('環境調整A'));
    expect(keepRecords).toHaveLength(0);
  });

  it('selected=false は採用記録に含まない', () => {
    const bundles = [adaptReviewProposal(makeReviewProposal())];
    const preview = buildProposalPreview(bundles);

    // 全部 deselect
    for (const item of preview.items) item.selected = false;

    const records = buildAdoptionRecords(preview.items, '鈴木');
    expect(records).toHaveLength(0);
  });
});
