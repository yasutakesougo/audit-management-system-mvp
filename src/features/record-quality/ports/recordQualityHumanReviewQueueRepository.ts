import type { RecordQualityHumanReviewQueue } from '../domain/recordQualityHumanReviewQueue';

export interface RecordQualityHumanReviewQueueRepository {
  listActiveQueue(): Promise<RecordQualityHumanReviewQueue>;
}
