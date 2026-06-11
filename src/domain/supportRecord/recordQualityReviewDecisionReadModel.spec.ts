import { describe, expect, it } from 'vitest';

import {
  acceptRecordQualityReviewDraft,
  createRecordQualityReviewDraft,
  discardRecordQualityReviewDraft,
  reviseRecordQualityReviewDraft,
  type RecordQualityReviewDraft,
  type RecordQualityReviewStatus,
} from './recordQualityReview';
import { toRecordQualityReviewDecision } from './recordQualityReviewDecisionReadModel';

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
const revisedReview = reviseRecordQualityReviewDraft(createBaseReview(), {
  notes: ['確認観点を修正した'],
  updatedAt: '2026-06-11T02:00:00.000Z',
});
const discardedReview = discardRecordQualityReviewDraft(
  createBaseReview(),
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
    const decision = toRecordQualityReviewDecision(fixture.review);

    expect(decision.status).toBe(fixture.expectedStatus);
    expect(decision.recordId).toBe('support-record-1');
    expect(decision.sourceRecordId).toBe('support-record-1');
    expect(decision.label).toBe(fixture.label);
    expect(decision.sourceOfTruth).toBe('original_record');
    expect(decision.outputKind).toBe('review_metadata');
    expect(decision.requiresHumanReview).toBe(true);
  });

  it.each(decisionFixtures)('does not expose original support record text for %s', fixture => {
    const decision = toRecordQualityReviewDecision(fixture.review);

    expect('body' in decision).toBe(false);
    expect('content' in decision).toBe(false);
    expect('originalText' in decision).toBe(false);
    expect('originalRecordText' in decision).toBe(false);
  });

  it('summarizes metadata counts without exposing review detail arrays', () => {
    const decision = toRecordQualityReviewDecision(draftReview);

    expect(decision.suggestedCategoryCount).toBe(1);
    expect(decision.missingInformationHintCount).toBe(1);
    expect(decision.noteCount).toBe(1);
    expect('suggestedCategories' in decision).toBe(false);
    expect('missingInformationHints' in decision).toBe(false);
    expect('notes' in decision).toBe(false);
  });

  it('keeps accepted, revised, and discarded fixture timestamps monotonic', () => {
    expect(toRecordQualityReviewDecision(draftReview).updatedAt).toBe(createdAt);
    expect(toRecordQualityReviewDecision(acceptedReview).updatedAt).toBe(
      '2026-06-11T01:00:00.000Z',
    );
    expect(toRecordQualityReviewDecision(revisedReview).updatedAt).toBe(
      '2026-06-11T02:00:00.000Z',
    );
    expect(toRecordQualityReviewDecision(discardedReview).updatedAt).toBe(
      '2026-06-11T03:00:00.000Z',
    );
  });
});
