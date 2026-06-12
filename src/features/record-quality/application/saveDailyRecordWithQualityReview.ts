import {
  createRecordQualityReviewFromSupportRecord,
} from '@/domain/supportRecord/recordQualityReviewCreationUseCase';
import type { RecordQualityReviewRepository } from '@/domain/supportRecord/recordQualityReviewRepository';
import type {
  DailyRecordRepository,
  DailyRecordRepositoryMutationParams,
  SaveDailyRecordInput,
} from '@/features/daily/domain/DailyRecordRepository';
import type { DailyRecordUserRow } from '@/features/daily/domain/schema';
import { auditLog } from '@/lib/debugLogger';

export type SaveDailyRecordWithQualityReviewInput = {
  readonly dailyRepository: DailyRecordRepository;
  readonly reviewRepository: RecordQualityReviewRepository;
  readonly input: SaveDailyRecordInput;
  readonly mutationParams?: DailyRecordRepositoryMutationParams;
  readonly createdAt: string;
};

export type SaveDailyRecordWithQualityReviewResult = {
  readonly savedDailyRecord: true;
  readonly createdReviewCount: number;
  readonly skippedReviewCount: number;
  readonly emptyTextSkippedReviewCount: number;
  readonly existingReviewSkippedReviewCount: number;
};

export async function saveDailyRecordWithQualityReview(
  input: SaveDailyRecordWithQualityReviewInput,
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

function buildReviewableSupportRecordText(row: DailyRecordUserRow): string {
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
