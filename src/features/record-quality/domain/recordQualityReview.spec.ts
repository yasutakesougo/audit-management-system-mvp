import { describe, expect, it } from 'vitest';

import {
  acceptRecordQualityReviewDraft,
  createRecordQualityReviewDraft,
  discardRecordQualityReviewDraft,
  RECORD_QUALITY_REVIEW_STATUSES,
  reviseRecordQualityReviewDraft,
  type RecordQualityMissingInformationHint,
  type RecordQualitySuggestedCategory,
} from '@/features/record-quality/domain/recordQualityReview';

const category: RecordQualitySuggestedCategory = {
  categoryId: 'mealsHydration',
  matchedSignals: ['昼食', '水分'],
  source: 'rule',
};

const missingInformationHint: RecordQualityMissingInformationHint = {
  code: 'staffSupportAction',
  label: '職員の支援内容',
  source: 'rule',
};

describe('recordQualityReview draft model', () => {
  it('creating a draft sets status to draft', () => {
    const draft = createRecordQualityReviewDraft({
      recordId: 'record-1',
      createdAt: '2026-06-10T00:00:00.000Z',
    });

    expect(draft.status).toBe('draft');
  });

  it('creating a draft sets sourceOfTruth to original_record', () => {
    const draft = createRecordQualityReviewDraft({
      recordId: 'record-1',
      createdAt: '2026-06-10T00:00:00.000Z',
    });

    expect(draft.sourceOfTruth).toBe('original_record');
    expect(draft.originalRecord).toEqual({ recordId: 'record-1' });
  });

  it('creating a draft sets outputKind to review_metadata', () => {
    const draft = createRecordQualityReviewDraft({
      recordId: 'record-1',
      createdAt: '2026-06-10T00:00:00.000Z',
    });

    expect(draft.outputKind).toBe('review_metadata');
  });

  it('creating a draft requires human review', () => {
    const draft = createRecordQualityReviewDraft({
      recordId: 'record-1',
      createdAt: '2026-06-10T00:00:00.000Z',
    });

    expect(draft.requiresHumanReview).toBe(true);
  });

  it('preserves suggested categories and missing information hints', () => {
    const draft = createRecordQualityReviewDraft({
      recordId: 'record-1',
      suggestedCategories: [category],
      missingInformationHints: [missingInformationHint],
      notes: ['人間レビューで確認する'],
      createdAt: '2026-06-10T00:00:00.000Z',
    });

    expect(draft.suggestedCategories).toEqual([category]);
    expect(draft.missingInformationHints).toEqual([missingInformationHint]);
    expect(draft.notes).toEqual(['人間レビューで確認する']);
  });

  it('accepting a draft changes status to accepted', () => {
    const draft = createRecordQualityReviewDraft({
      recordId: 'record-1',
      createdAt: '2026-06-10T00:00:00.000Z',
    });

    const accepted = acceptRecordQualityReviewDraft(draft, '2026-06-10T01:00:00.000Z');

    expect(accepted.status).toBe('accepted');
    expect(accepted.recordId).toBe('record-1');
  });

  it('revising a draft changes status to revised and preserves source-of-truth metadata', () => {
    const draft = createRecordQualityReviewDraft({
      recordId: 'record-1',
      suggestedCategories: [category],
      createdAt: '2026-06-10T00:00:00.000Z',
    });

    const revised = reviseRecordQualityReviewDraft(draft, {
      missingInformationHints: [missingInformationHint],
      notes: ['表現を具体化してから採用する'],
      updatedAt: '2026-06-10T01:30:00.000Z',
    });

    expect(revised.status).toBe('revised');
    expect(revised.recordId).toBe('record-1');
    expect(revised.sourceOfTruth).toBe('original_record');
    expect(revised.outputKind).toBe('review_metadata');
    expect(revised.requiresHumanReview).toBe(true);
    expect(revised.suggestedCategories).toEqual([category]);
    expect(revised.missingInformationHints).toEqual([missingInformationHint]);
  });

  it('discarding a draft changes status to discarded', () => {
    const draft = createRecordQualityReviewDraft({
      recordId: 'record-1',
      createdAt: '2026-06-10T00:00:00.000Z',
    });

    const discarded = discardRecordQualityReviewDraft(draft, '2026-06-10T02:00:00.000Z');

    expect(discarded.status).toBe('discarded');
    expect(discarded.recordId).toBe('record-1');
  });

  it('does not store or rewrite original record text', () => {
    const draft = createRecordQualityReviewDraft({
      recordId: 'record-1',
      notes: ['原文の要約ではなく確認観点のみ'],
      createdAt: '2026-06-10T00:00:00.000Z',
    });

    expect('originalText' in draft).toBe(false);
    expect(draft.originalRecord).toEqual({ recordId: 'record-1' });
  });

  it('does not expose diagnostic or judgmental status values', () => {
    expect(RECORD_QUALITY_REVIEW_STATUSES).toEqual([
      'draft',
      'accepted',
      'revised',
      'discarded',
    ]);
    expect(RECORD_QUALITY_REVIEW_STATUSES).not.toContain('diagnosed');
    expect(RECORD_QUALITY_REVIEW_STATUSES).not.toContain('evaluated');
    expect(RECORD_QUALITY_REVIEW_STATUSES).not.toContain('policyDetermined');
  });

  it('fixes prohibited safety actions on every transition', () => {
    const draft = createRecordQualityReviewDraft({
      recordId: 'record-1',
      createdAt: '2026-06-10T00:00:00.000Z',
    });
    const accepted = acceptRecordQualityReviewDraft(draft, '2026-06-10T01:00:00.000Z');

    expect(accepted.prohibitedActions).toEqual([
      'diagnose_users',
      'judge_behavior',
      'determine_support_policy',
      'overwrite_original_record',
    ]);
  });

  it.each([
    {
      label: 'accept',
      transition: (draft: ReturnType<typeof createRecordQualityReviewDraft>) =>
        acceptRecordQualityReviewDraft(draft, '2026-06-10T01:00:00.000Z'),
      expectedStatus: 'accepted',
    },
    {
      label: 'revise',
      transition: (draft: ReturnType<typeof createRecordQualityReviewDraft>) =>
        reviseRecordQualityReviewDraft(draft, {
          notes: ['人間レビューで確認観点だけを修正する'],
          updatedAt: '2026-06-10T01:00:00.000Z',
        }),
      expectedStatus: 'revised',
    },
    {
      label: 'discard',
      transition: (draft: ReturnType<typeof createRecordQualityReviewDraft>) =>
        discardRecordQualityReviewDraft(draft, '2026-06-10T01:00:00.000Z'),
      expectedStatus: 'discarded',
    },
  ])('allows draft -> $expectedStatus by $label action', ({ transition, expectedStatus }) => {
    const draft = createRecordQualityReviewDraft({
      recordId: 'record-1',
      createdAt: '2026-06-10T00:00:00.000Z',
    });

    const decided = transition(draft);

    expect(decided.status).toBe(expectedStatus);
    expect(decided.updatedAt).toBe('2026-06-10T01:00:00.000Z');
  });

  it.each([
    {
      label: 'accepted -> accepted',
      createCurrent: (draft: ReturnType<typeof createRecordQualityReviewDraft>) =>
        acceptRecordQualityReviewDraft(draft, '2026-06-10T01:00:00.000Z'),
      transition: (current: ReturnType<typeof createRecordQualityReviewDraft>) =>
        acceptRecordQualityReviewDraft(current, '2026-06-10T02:00:00.000Z'),
      expectedMessage: 'Cannot transition record quality review from accepted to accepted',
    },
    {
      label: 'discarded -> accepted',
      createCurrent: (draft: ReturnType<typeof createRecordQualityReviewDraft>) =>
        discardRecordQualityReviewDraft(draft, '2026-06-10T01:00:00.000Z'),
      transition: (current: ReturnType<typeof createRecordQualityReviewDraft>) =>
        acceptRecordQualityReviewDraft(current, '2026-06-10T02:00:00.000Z'),
      expectedMessage: 'Cannot transition record quality review from discarded to accepted',
    },
    {
      label: 'accepted -> discarded',
      createCurrent: (draft: ReturnType<typeof createRecordQualityReviewDraft>) =>
        acceptRecordQualityReviewDraft(draft, '2026-06-10T01:00:00.000Z'),
      transition: (current: ReturnType<typeof createRecordQualityReviewDraft>) =>
        discardRecordQualityReviewDraft(current, '2026-06-10T02:00:00.000Z'),
      expectedMessage: 'Cannot transition record quality review from accepted to discarded',
    },
  ])('rejects invalid human review transition: $label', ({
    createCurrent,
    transition,
    expectedMessage,
  }) => {
    const draft = createRecordQualityReviewDraft({
      recordId: 'record-1',
      createdAt: '2026-06-10T00:00:00.000Z',
    });
    const current = createCurrent(draft);

    expect(() => transition(current)).toThrow(expectedMessage);
  });
});
