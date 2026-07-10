import type {
  RecordQualityHumanReviewQueue,
} from '@/features/record-quality/domain/recordQualityHumanReviewQueue';
import type { RecordQualityHumanReviewQueueRepository } from '@/features/record-quality/ports/recordQualityHumanReviewQueueRepository';

export type ListRecordQualityHumanReviewQueueInput = {
  readonly repository: RecordQualityHumanReviewQueueRepository;
};

export async function listRecordQualityHumanReviewQueue(
  input: ListRecordQualityHumanReviewQueueInput,
): Promise<RecordQualityHumanReviewQueue> {
  return input.repository.listActiveQueue();
}
