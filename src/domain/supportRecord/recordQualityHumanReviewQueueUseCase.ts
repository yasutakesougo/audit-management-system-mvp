import type {
  RecordQualityHumanReviewQueue,
  RecordQualityHumanReviewQueueRepository,
} from './recordQualityHumanReviewQueue';

export type ListRecordQualityHumanReviewQueueInput = {
  readonly repository: RecordQualityHumanReviewQueueRepository;
};

export async function listRecordQualityHumanReviewQueue(
  input: ListRecordQualityHumanReviewQueueInput,
): Promise<RecordQualityHumanReviewQueue> {
  return input.repository.listActiveQueue();
}
