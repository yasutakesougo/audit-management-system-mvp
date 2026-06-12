import type { RecordQualityReviewDraft } from './recordQualityReview';
import {
  toRecordQualityReviewDecision,
  type RecordQualityReviewDecision,
} from './recordQualityReviewDecisionReadModel';
import type { RecordQualityReviewRepository } from './recordQualityReviewRepository';

export type RecordQualityHumanReviewQueueItem = RecordQualityReviewDecision;

export type RecordQualityHumanReviewQueueSummary = {
  readonly draftCount: number;
  readonly revisedCount: number;
  readonly acceptedCount: number;
  readonly discardedCount: number;
  readonly pendingTotalCount: number;
  readonly reviewedTotalCount: number;
};

export const emptyRecordQualityHumanReviewQueueSummary: RecordQualityHumanReviewQueueSummary = {
  draftCount: 0,
  revisedCount: 0,
  acceptedCount: 0,
  discardedCount: 0,
  pendingTotalCount: 0,
  reviewedTotalCount: 0,
};

export type RecordQualityHumanReviewQueue = {
  readonly items: readonly RecordQualityHumanReviewQueueItem[];
  readonly totalCount: number;
  readonly oldestUpdatedAt?: string;
  readonly summary: RecordQualityHumanReviewQueueSummary;
};

export interface RecordQualityHumanReviewQueueRepository {
  listActiveQueue(): Promise<RecordQualityHumanReviewQueue>;
}

export class InMemoryRecordQualityHumanReviewQueueRepository
  implements RecordQualityHumanReviewQueueRepository
{
  constructor(
    private readonly reviewRepository: Pick<RecordQualityReviewRepository, 'listReviews'>,
  ) {}

  async listActiveQueue(): Promise<RecordQualityHumanReviewQueue> {
    return buildRecordQualityHumanReviewQueue(await this.reviewRepository.listReviews());
  }
}

export function buildRecordQualityHumanReviewQueue(
  reviews: readonly RecordQualityReviewDraft[],
): RecordQualityHumanReviewQueue {
  const summary = buildRecordQualityHumanReviewQueueSummary(reviews);
  const items = reviews
    .filter(review => review.requiresHumanReview)
    .filter(review => review.status === 'draft' || review.status === 'revised')
    .map(toRecordQualityReviewDecision)
    .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));

  return {
    items,
    totalCount: items.length,
    oldestUpdatedAt: items[0]?.updatedAt,
    summary,
  };
}

export function buildRecordQualityHumanReviewQueueSummary(
  reviews: readonly RecordQualityReviewDraft[],
): RecordQualityHumanReviewQueueSummary {
  const reviewMetadata = reviews.filter(review => review.requiresHumanReview);
  const draftCount = reviewMetadata.filter(review => review.status === 'draft').length;
  const revisedCount = reviewMetadata.filter(review => review.status === 'revised').length;
  const acceptedCount = reviewMetadata.filter(review => review.status === 'accepted').length;
  const discardedCount = reviewMetadata.filter(review => review.status === 'discarded').length;

  return {
    ...emptyRecordQualityHumanReviewQueueSummary,
    draftCount,
    revisedCount,
    acceptedCount,
    discardedCount,
    pendingTotalCount: draftCount + revisedCount,
    reviewedTotalCount: acceptedCount + discardedCount,
  };
}
