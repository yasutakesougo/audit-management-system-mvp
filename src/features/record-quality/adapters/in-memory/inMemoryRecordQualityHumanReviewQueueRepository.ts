import { buildRecordQualityHumanReviewQueue } from '../../domain/recordQualityHumanReviewQueue';
import type { RecordQualityHumanReviewQueueRepository } from '../../ports/recordQualityHumanReviewQueueRepository';
import type { RecordQualityReviewRepository } from '../../ports/recordQualityReviewRepository';
export {
  buildRecordQualityHumanReviewQueue,
  emptyRecordQualityHumanReviewQueueSummary,
} from '../../domain/recordQualityHumanReviewQueue';
export type { RecordQualityHumanReviewQueueRepository } from '../../ports/recordQualityHumanReviewQueueRepository';

export class InMemoryRecordQualityHumanReviewQueueRepository
  implements RecordQualityHumanReviewQueueRepository
{
  constructor(
    private readonly reviewRepository: Pick<RecordQualityReviewRepository, 'listReviews'>,
  ) {}

  async listActiveQueue() {
    return buildRecordQualityHumanReviewQueue(await this.reviewRepository.listReviews());
  }
}
