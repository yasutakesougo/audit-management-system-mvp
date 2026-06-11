import { describe, expect, it } from 'vitest';

import {
  acceptRecordQualityReviewDraft,
  createRecordQualityReviewDraft,
  type RecordQualityReviewDraft,
} from './recordQualityReview';
import {
  fromRecordQualityReviewPersistenceItem,
  toRecordQualityReviewPersistenceItem,
  type RecordQualityReviewPersistenceItem,
} from './recordQualityReviewPersistenceMapper';

const createDraft = (): RecordQualityReviewDraft =>
  createRecordQualityReviewDraft({
    recordId: 'record-1',
    suggestedCategories: [
      {
        categoryId: 'mealsHydration',
        matchedSignals: ['昼食', '水分'],
        source: 'rule',
      },
      {
        categoryId: 'staffSupportActions',
        matchedSignals: ['職員', '提案'],
        source: 'ai',
      },
    ],
    missingInformationHints: [
      {
        code: 'userResponseAfterSupport',
        label: '支援後の本人の反応',
        source: 'rule',
      },
    ],
    notes: ['人間レビューで確認する'],
    createdAt: '2026-06-11T00:00:00.000Z',
  });

describe('recordQualityReviewPersistenceMapper', () => {
  it('maps review draft metadata to a persistence item', () => {
    const item = toRecordQualityReviewPersistenceItem({
      ...createDraft(),
      reviewerId: 'staff-1',
      reviewerName: '山田 花子',
    } as RecordQualityReviewDraft & {
      reviewerId: string;
      reviewerName: string;
    });

    expect(item).toMatchObject({
      recordId: 'record-1',
      sourceRecordId: 'record-1',
      status: 'draft',
      reviewerId: 'staff-1',
      reviewerName: '山田 花子',
      createdAt: '2026-06-11T00:00:00.000Z',
      updatedAt: '2026-06-11T00:00:00.000Z',
    });
    expect(JSON.parse(item.suggestedCategoriesJson)).toEqual([
      {
        categoryId: 'mealsHydration',
        matchedSignals: ['昼食', '水分'],
        source: 'rule',
      },
      {
        categoryId: 'staffSupportActions',
        matchedSignals: ['職員', '提案'],
        source: 'ai',
      },
    ]);
    expect(JSON.parse(item.missingInfoHintsJson)).toEqual([
      {
        code: 'userResponseAfterSupport',
        label: '支援後の本人の反応',
        source: 'rule',
      },
    ]);
    expect(JSON.parse(item.reviewerNotesJson)).toEqual(['人間レビューで確認する']);
  });

  it('maps persistence items back to repository-compatible review drafts', () => {
    const accepted = acceptRecordQualityReviewDraft(createDraft(), '2026-06-11T01:00:00.000Z');
    const restored = fromRecordQualityReviewPersistenceItem(
      toRecordQualityReviewPersistenceItem(accepted),
    );

    expect(restored).toEqual(accepted);
    expect(restored.originalRecord).toEqual({ recordId: 'record-1' });
    expect(restored.sourceOfTruth).toBe('original_record');
    expect(restored.outputKind).toBe('review_metadata');
    expect(restored.requiresHumanReview).toBe(true);
  });

  it('does not include original record text in the persistence item', () => {
    const draftWithText = {
      ...createDraft(),
      originalText: '元の支援記録本文は保存対象に含めない',
      originalRecordText: '別名で紛れ込んだ本文も保存しない',
    } as RecordQualityReviewDraft & {
      originalText: string;
      originalRecordText: string;
    };

    const item = toRecordQualityReviewPersistenceItem(draftWithText);

    expect('originalText' in item).toBe(false);
    expect('originalRecordText' in item).toBe(false);
    expect(Object.keys(item)).toEqual([
      'recordId',
      'sourceRecordId',
      'status',
      'reviewerId',
      'reviewerName',
      'suggestedCategoriesJson',
      'missingInfoHintsJson',
      'reviewerNotesJson',
      'createdAt',
      'updatedAt',
    ]);
  });

  it('preserves source record id separately from the persistence record id', () => {
    const item: RecordQualityReviewPersistenceItem = {
      ...toRecordQualityReviewPersistenceItem(createDraft()),
      recordId: 'review-row-1',
      sourceRecordId: 'support-record-1',
    };

    const restored = fromRecordQualityReviewPersistenceItem(item);

    expect(restored.recordId).toBe('review-row-1');
    expect(restored.originalRecord).toEqual({ recordId: 'support-record-1' });
  });

  it('rejects unsupported statuses and non-array JSON fields', () => {
    const item = toRecordQualityReviewPersistenceItem(createDraft());

    expect(() =>
      fromRecordQualityReviewPersistenceItem({
        ...item,
        status: 'diagnosed' as RecordQualityReviewPersistenceItem['status'],
      }),
    ).toThrow('Unsupported record quality review status');

    expect(() =>
      fromRecordQualityReviewPersistenceItem({
        ...item,
        suggestedCategoriesJson: '{}',
      }),
    ).toThrow('Record quality review persistence field must be an array');
  });
});
