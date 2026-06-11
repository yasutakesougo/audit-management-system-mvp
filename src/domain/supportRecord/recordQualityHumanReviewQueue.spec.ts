import { describe, expect, it } from 'vitest';

import {
  acceptRecordQualityReviewDraft,
  createRecordQualityReviewDraft,
  discardRecordQualityReviewDraft,
  reviseRecordQualityReviewDraft,
  type RecordQualityReviewDraft,
} from './recordQualityReview';
import { buildRecordQualityHumanReviewQueue } from './recordQualityHumanReviewQueue';

function createReview(recordId: string, createdAt: string): RecordQualityReviewDraft {
  return createRecordQualityReviewDraft({
    recordId,
    suggestedCategories: [
      {
        categoryId: 'staffSupportActions',
        matchedSignals: ['職員', '声かけ'],
        source: 'rule',
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
    createdAt,
  });
}

describe('record quality human review queue sorting and filters', () => {
  const oldestDraft = createReview('record-oldest-draft', '2026-06-11T00:00:00.000Z');
  const newerDraft = createReview('record-newer-draft', '2026-06-11T01:00:00.000Z');
  const accepted = acceptRecordQualityReviewDraft(
    createReview('record-accepted', '2026-06-11T02:00:00.000Z'),
    '2026-06-11T03:00:00.000Z',
  );
  const revised = reviseRecordQualityReviewDraft(
    createReview('record-revised', '2026-06-11T04:00:00.000Z'),
    {
      notes: ['人間レビューで修正済みだが再確認する'],
      updatedAt: '2026-06-11T05:00:00.000Z',
    },
  );
  const discarded = discardRecordQualityReviewDraft(
    createReview('record-discarded', '2026-06-11T06:00:00.000Z'),
    '2026-06-11T07:00:00.000Z',
  );

  it('includes draft and revised reviews in the pending human review queue', () => {
    const queue = buildRecordQualityHumanReviewQueue([
      accepted,
      revised,
      discarded,
      newerDraft,
      oldestDraft,
    ]);

    expect(queue.totalCount).toBe(3);
    expect(queue.oldestUpdatedAt).toBe('2026-06-11T00:00:00.000Z');
    expect(queue.items.map(item => item.recordId)).toEqual([
      'record-oldest-draft',
      'record-newer-draft',
      'record-revised',
    ]);
    expect(queue.items.map(item => item.status)).toEqual(['draft', 'draft', 'revised']);
  });

  it('excludes accepted and discarded reviews from the pending queue', () => {
    const queue = buildRecordQualityHumanReviewQueue([
      accepted,
      discarded,
      oldestDraft,
      revised,
    ]);

    expect(queue.items.map(item => item.recordId)).not.toContain('record-accepted');
    expect(queue.items.map(item => item.recordId)).not.toContain('record-discarded');
  });

  it('keeps queue items limited to review metadata and source record references', () => {
    const draftWithOriginalText = {
      ...oldestDraft,
      body: '元の支援記録本文',
      content: '本人の反応などの本文',
      originalText: 'original text',
    } as RecordQualityReviewDraft & {
      body: string;
      content: string;
      originalText: string;
    };

    const [item] = buildRecordQualityHumanReviewQueue([draftWithOriginalText]).items;

    expect(item.sourceOfTruth).toBe('original_record');
    expect(item.outputKind).toBe('review_metadata');
    expect(item.requiresHumanReview).toBe(true);
    expect(item.sourceRecordId).toBe('record-oldest-draft');
    expect('body' in item).toBe(false);
    expect('content' in item).toBe(false);
    expect('originalText' in item).toBe(false);
  });

  it('returns an empty queue model when no review requires action', () => {
    const queue = buildRecordQualityHumanReviewQueue([accepted, discarded]);

    expect(queue).toEqual({
      items: [],
      totalCount: 0,
      oldestUpdatedAt: undefined,
    });
  });
});
