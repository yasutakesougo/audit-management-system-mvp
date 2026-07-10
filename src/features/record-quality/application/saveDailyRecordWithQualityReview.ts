import {
  createRecordQualityReviewFromSupportRecord,
} from '@/features/record-quality/application/recordQualityReviewCreationUseCase';
import type { RecordQualityReviewRepository } from '@/features/record-quality/ports/recordQualityReviewRepository';
import { auditLog } from '@/lib/debugLogger';

export type ReviewableDailyRecordRow = {
  readonly userId: string;
  readonly amActivity: string;
  readonly pmActivity: string;
  readonly lunchAmount: string;
  readonly specialNotes: string;
};

export type ReviewableDailyRecordInput = {
  readonly date: string;
  readonly userRows: readonly ReviewableDailyRecordRow[];
};

export type DailyRecordSavePort<TInput, TMutationParams = unknown> = {
  save(input: TInput, params?: TMutationParams): Promise<void>;
};

export type SaveDailyRecordWithQualityReviewInput<
  TInput extends ReviewableDailyRecordInput = ReviewableDailyRecordInput,
  TMutationParams = unknown,
> = {
  readonly dailyRepository: DailyRecordSavePort<TInput, TMutationParams>;
  readonly reviewRepository: RecordQualityReviewRepository;
  readonly input: TInput;
  readonly mutationParams?: TMutationParams;
  readonly createdAt: string;
};

export type SaveDailyRecordWithQualityReviewResult = {
  readonly savedDailyRecord: true;
  readonly createdReviewCount: number;
  readonly skippedReviewCount: number;
  readonly emptyTextSkippedReviewCount: number;
  readonly existingReviewSkippedReviewCount: number;
};

export async function saveDailyRecordWithQualityReview<
  TInput extends ReviewableDailyRecordInput,
  TMutationParams = unknown,
>(
  input: SaveDailyRecordWithQualityReviewInput<TInput, TMutationParams>,
): Promise<SaveDailyRecordWithQualityReviewResult> {
  await input.dailyRepository.save(input.input, input.mutationParams);

  let createdReviewCount = 0;
  let emptyTextSkippedReviewCount = 0;
  let existingReviewSkippedReviewCount = 0;

  for (const row of input.input.userRows) {
    const recordId = buildDailyRecordQualityReviewId(input.input.date, row.userId);
    const text = buildReviewableSupportRecordText(row);
    if (!text) {
      emptyTextSkippedReviewCount += 1;
      continue;
    }

    const existing = await input.reviewRepository.getReview(recordId);
    if (existing) {
      existingReviewSkippedReviewCount += 1;
      continue;
    }

    await createRecordQualityReviewFromSupportRecord({
      repository: input.reviewRepository,
      recordId,
      text,
      createdAt: input.createdAt,
    });
    createdReviewCount += 1;
  }

  const skippedReviewCount = emptyTextSkippedReviewCount + existingReviewSkippedReviewCount;

  auditLog.info('record-quality:daily-save', 'Review metadata creation completed', {
    date: input.input.date,
    userRowCount: input.input.userRows.length,
    createdReviewCount,
    skippedReviewCount,
    emptyTextSkippedReviewCount,
    existingReviewSkippedReviewCount,
  });

  return {
    savedDailyRecord: true,
    createdReviewCount,
    skippedReviewCount,
    emptyTextSkippedReviewCount,
    existingReviewSkippedReviewCount,
  };
}

export function buildDailyRecordQualityReviewId(date: string, userId: string): string {
  return `daily:${date}:${userId}`;
}

function buildReviewableSupportRecordText(row: ReviewableDailyRecordRow): string {
  return [
    row.amActivity,
    row.pmActivity,
    row.lunchAmount ? `昼食: ${row.lunchAmount}` : '',
    row.specialNotes,
  ]
    .map(value => value.trim())
    .filter(Boolean)
    .join('\n');
}
