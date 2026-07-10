import {
  classifyRecordQuality,
  type RecordQualityInput,
} from '@/features/record-quality/domain/recordQuality';
import {
  projectRecordQualityReviewDraft,
  type RecordQualityReviewProjectionSource,
} from '@/features/record-quality/domain/recordQualityReviewProjection';
import type { RecordQualityReviewDraft } from '@/features/record-quality/domain/recordQualityReview';
import type { RecordQualityReviewRepository } from '@/features/record-quality/ports/recordQualityReviewRepository';

export type CreateRecordQualityReviewFromSupportRecordInput = RecordQualityInput & {
  readonly repository: RecordQualityReviewRepository;
  readonly createdAt: string;
  readonly source?: RecordQualityReviewProjectionSource;
  readonly notes?: readonly string[];
};

export async function createRecordQualityReviewFromSupportRecord(
  input: CreateRecordQualityReviewFromSupportRecordInput,
): Promise<RecordQualityReviewDraft> {
  const classification = classifyRecordQuality({
    recordId: input.recordId,
    text: input.text,
  });
  const review = projectRecordQualityReviewDraft({
    classification,
    createdAt: input.createdAt,
    source: input.source,
    notes: input.notes,
  });

  return input.repository.saveReview(review);
}
