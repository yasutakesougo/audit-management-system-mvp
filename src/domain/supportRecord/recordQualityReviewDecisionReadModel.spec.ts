import { describe, expect, it } from 'vitest';

import {
  acceptRecordQualityReviewDraft,
  createRecordQualityReviewDraft,
  discardRecordQualityReviewDraft,
  reviseRecordQualityReviewDraft,
  type RecordQualityReviewDraft,
  type RecordQualityReviewStatus,
} from './recordQualityReview';

type ReviewDecisionFixture = {
  readonly label: string;
  readonly expectedStatus: RecordQualityReviewStatus;
  readonly review: RecordQualityReviewDraft;
};

const createdAt = '2026-06-11T00:00:00.000Z';

function createBaseReview(recordId = 'support-record-1'): RecordQualityReviewDraft {
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

const draftReview = createBaseReview();
const acceptedReview = acceptRecordQualityReviewDraft(
  draftReview,
  '2026-06-11T01:00:00.000Z',
);
const revisedReview = reviseRecordQualityReviewDraft(acceptedReview, {
  notes: ['確認観点を修正した'],
  updatedAt: '2026-06-11T02:00:00.000Z',
});
const discardedReview = discardRecordQualityReviewDraft(
  revisedReview,
  '2026-06-11T03:00:00.000Z',
);

const decisionFixtures: readonly ReviewDecisionFixture[] = [
  {
    label: 'pending human review',
    expectedStatus: 'draft',
    review: draftReview,
  },
  {
    label: 'accepted by human reviewer',
    expectedStatus: 'accepted',
    review: acceptedReview,
  },
  {
    label: 'revised by human reviewer',
    expectedStatus: 'revised',
    review: revisedReview,
  },
  {
    label: 'discarded by human reviewer',
    expectedStatus: 'discarded',
    review: discardedReview,
  },
];

describe('record quality review decision read model fixtures', () => {
  it('covers every review decision status used by the human review lifecycle', () => {
    expect(decisionFixtures.map(fixture => fixture.expectedStatus)).toEqual([
      'draft',
      'accepted',
      'revised',
      'discarded',
    ]);
  });

  it.each(decisionFixtures)('keeps %s metadata tied to the original record reference', fixture => {
    expect(fixture.review.status).toBe(fixture.expectedStatus);
    expect(fixture.review.recordId).toBe('support-record-1');
    expect(fixture.review.originalRecord).toEqual({ recordId: 'support-record-1' });
    expect(fixture.review.sourceOfTruth).toBe('original_record');
    expect(fixture.review.outputKind).toBe('review_metadata');
    expect(fixture.review.requiresHumanReview).toBe(true);
  });

  it.each(decisionFixtures)('does not expose original support record text for %s', fixture => {
    expect('body' in fixture.review).toBe(false);
    expect('content' in fixture.review).toBe(false);
    expect('originalText' in fixture.review).toBe(false);
    expect('originalRecordText' in fixture.review).toBe(false);
  });

  it('keeps accepted, revised, and discarded fixture timestamps monotonic', () => {
    expect(draftReview.updatedAt).toBe(createdAt);
    expect(acceptedReview.updatedAt).toBe('2026-06-11T01:00:00.000Z');
    expect(revisedReview.updatedAt).toBe('2026-06-11T02:00:00.000Z');
    expect(discardedReview.updatedAt).toBe('2026-06-11T03:00:00.000Z');
  });
});
