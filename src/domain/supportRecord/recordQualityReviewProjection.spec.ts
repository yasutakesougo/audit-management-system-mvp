import { describe, expect, it } from 'vitest';

import {
  RECORD_QUALITY_SAFETY_METADATA,
  type RecordQualityReviewDraft as RecordQualityClassificationDraft,
} from './recordQuality';
import { projectRecordQualityReviewDraft } from './recordQualityReviewProjection';

const classification: RecordQualityClassificationDraft = {
  recordId: 'record-1',
  originalText: '12:10から昼食。水分はコップ半分程度。職員が休憩を提案した。',
  categoryCandidates: [
    { categoryId: 'mealsHydration', matchedSignals: ['昼食', '水分'] },
    { categoryId: 'staffSupportActions', matchedSignals: ['職員', '提案'] },
  ],
  missingInformation: [
    { code: 'scene', label: '場面や状況', present: true },
    { code: 'userResponseAfterSupport', label: '支援後の本人の反応', present: false },
    { code: 'environmentalFactors', label: '関係する環境要因', present: false },
  ],
  safety: RECORD_QUALITY_SAFETY_METADATA,
};

describe('recordQualityReviewProjection', () => {
  it('projects classification metadata into a draft review model', () => {
    const draft = projectRecordQualityReviewDraft({
      classification,
      createdAt: '2026-06-11T00:00:00.000Z',
    });

    expect(draft.recordId).toBe('record-1');
    expect(draft.originalRecord).toEqual({ recordId: 'record-1' });
    expect(draft.status).toBe('draft');
    expect(draft.createdAt).toBe('2026-06-11T00:00:00.000Z');
    expect(draft.updatedAt).toBe('2026-06-11T00:00:00.000Z');
  });

  it('projects category candidates as rule-sourced suggestions by default', () => {
    const draft = projectRecordQualityReviewDraft({
      classification,
      createdAt: '2026-06-11T00:00:00.000Z',
    });

    expect(draft.suggestedCategories).toEqual([
      { categoryId: 'mealsHydration', matchedSignals: ['昼食', '水分'], source: 'rule' },
      { categoryId: 'staffSupportActions', matchedSignals: ['職員', '提案'], source: 'rule' },
    ]);
  });

  it('projects only missing information checks that are absent', () => {
    const draft = projectRecordQualityReviewDraft({
      classification,
      createdAt: '2026-06-11T00:00:00.000Z',
    });

    expect(draft.missingInformationHints).toEqual([
      {
        code: 'userResponseAfterSupport',
        label: '支援後の本人の反応',
        source: 'rule',
      },
      {
        code: 'environmentalFactors',
        label: '関係する環境要因',
        source: 'rule',
      },
    ]);
    expect(draft.missingInformationHints.map(hint => hint.code)).not.toContain('scene');
  });

  it('does not copy original record text into review metadata', () => {
    const draft = projectRecordQualityReviewDraft({
      classification,
      createdAt: '2026-06-11T00:00:00.000Z',
    });

    expect('originalText' in draft).toBe(false);
    expect(draft.originalRecord).toEqual({ recordId: 'record-1' });
  });

  it('preserves review safety boundaries and human review requirements', () => {
    const draft = projectRecordQualityReviewDraft({
      classification,
      createdAt: '2026-06-11T00:00:00.000Z',
    });

    expect(draft.sourceOfTruth).toBe('original_record');
    expect(draft.outputKind).toBe('review_metadata');
    expect(draft.requiresHumanReview).toBe(true);
    expect(draft.prohibitedActions).toEqual([
      'diagnose_users',
      'judge_behavior',
      'determine_support_policy',
      'overwrite_original_record',
    ]);
  });

  it('allows ai-sourced suggestions without changing review safety metadata', () => {
    const draft = projectRecordQualityReviewDraft({
      classification,
      source: 'ai',
      notes: ['AI候補は人間レビュー前提で扱う'],
      createdAt: '2026-06-11T00:00:00.000Z',
    });

    expect(draft.suggestedCategories.every(category => category.source === 'ai')).toBe(true);
    expect(draft.missingInformationHints.every(hint => hint.source === 'ai')).toBe(true);
    expect(draft.notes).toEqual(['AI候補は人間レビュー前提で扱う']);
    expect(draft.status).toBe('draft');
    expect(draft.requiresHumanReview).toBe(true);
  });
});
