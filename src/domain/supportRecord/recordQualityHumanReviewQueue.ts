import type { RecordQualityReviewDraft } from './recordQualityReview';
import {
  toRecordQualityReviewDecision,
  type RecordQualityReviewDecision,
} from './recordQualityReviewDecisionReadModel';

export type RecordQualityHumanReviewQueueItem = RecordQualityReviewDecision;

export type RecordQualityHumanReviewQueue = {
  readonly items: readonly RecordQualityHumanReviewQueueItem[];
  readonly totalCount: number;
  readonly oldestUpdatedAt?: string;
};

export function buildRecordQualityHumanReviewQueue(
  reviews: readonly RecordQualityReviewDraft[],
): RecordQualityHumanReviewQueue {
  const items = reviews
    .filter(review => review.requiresHumanReview)
    .filter(review => review.status === 'draft' || review.status === 'revised')
    .map(toRecordQualityReviewDecision)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

  return {
    items,
    totalCount: items.length,
    oldestUpdatedAt: items[0]?.updatedAt,
  };
}
