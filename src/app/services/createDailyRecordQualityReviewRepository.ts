import type { DailyRecordRepository } from '@/features/daily';
import {
  saveDailyRecordWithQualityReview,
  type RecordQualityReviewRepository,
} from '@/features/record-quality';

export type CreateDailyRecordQualityReviewRepositoryOptions = {
  readonly dailyRepository: DailyRecordRepository;
  readonly reviewRepository: RecordQualityReviewRepository;
  readonly now?: () => string;
};

/**
 * Adds record-quality metadata creation to daily saves while preserving the
 * complete DailyRecordRepository contract for the UI.
 */
export function createDailyRecordQualityReviewRepository({
  dailyRepository,
  reviewRepository,
  now = () => new Date().toISOString(),
}: CreateDailyRecordQualityReviewRepositoryOptions): DailyRecordRepository {
  return {
    async save(input, params) {
      await saveDailyRecordWithQualityReview({
        dailyRepository,
        reviewRepository,
        input: {
          ...input,
          userCount: input.userRows.length,
        },
        mutationParams: params,
        createdAt: now(),
      });
    },
    load: date => dailyRepository.load(date),
    list: params => dailyRepository.list(params),
    approve: (input, params) => dailyRepository.approve(input, params),
    scanIntegrity: (dates, signal) => dailyRepository.scanIntegrity(dates, signal),
  };
}
