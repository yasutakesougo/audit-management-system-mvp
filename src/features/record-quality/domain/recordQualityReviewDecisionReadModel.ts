import type {
  RecordQualityReviewDraft,
  RecordQualityReviewStatus,
} from '@/features/record-quality/domain/recordQualityReview';

export type RecordQualityReviewDecision = {
  readonly recordId: string;
  readonly sourceRecordId: string;
  readonly status: RecordQualityReviewStatus;
  readonly label: string;
  readonly suggestedCategoryCount: number;
  readonly missingInformationHintCount: number;
  readonly noteCount: number;
  readonly updatedAt: string;
  readonly sourceOfTruth: 'original_record';
  readonly outputKind: 'review_metadata';
  readonly requiresHumanReview: true;
};

export function toRecordQualityReviewDecision(
  review: RecordQualityReviewDraft,
): RecordQualityReviewDecision {
  return {
    recordId: review.recordId,
    sourceRecordId: review.originalRecord.recordId,
    status: review.status,
    label: labelForStatus(review.status),
    suggestedCategoryCount: review.suggestedCategories.length,
    missingInformationHintCount: review.missingInformationHints.length,
    noteCount: review.notes.length,
    updatedAt: review.updatedAt,
    sourceOfTruth: 'original_record',
    outputKind: 'review_metadata',
    requiresHumanReview: true,
  };
}

function labelForStatus(status: RecordQualityReviewStatus): string {
  switch (status) {
    case 'draft':
      return 'pending human review';
    case 'accepted':
      return 'accepted by human reviewer';
    case 'revised':
      return 'revised by human reviewer';
    case 'discarded':
      return 'discarded by human reviewer';
  }
}
