import type { RecordQualityReviewDraft } from './recordQualityReview';
import {
  toRecordQualityReviewDecision,
  type RecordQualityReviewDecision,
} from './recordQualityReviewDecisionReadModel';
import type { RecordQualityReviewRepository } from './recordQualityReviewRepository';

export type RecordQualityHumanReviewQueueItem = RecordQualityReviewDecision;

export type RecordQualityHumanReviewQueue = {
  readonly items: readonly RecordQualityHumanReviewQueueItem[];
  readonly totalCount: number;
  readonly oldestUpdatedAt?: string;
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
