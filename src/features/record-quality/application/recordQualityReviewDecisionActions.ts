import {
  acceptRecordQualityReviewDraft,
  discardRecordQualityReviewDraft,
  reviseRecordQualityReviewDraft,
  type RecordQualityReviewDraft,
  type ReviseRecordQualityReviewDraftInput,
} from '@/features/record-quality/domain/recordQualityReview';
import type {
  RecordQualityReviewRecordId,
  RecordQualityReviewRepository,
} from '@/features/record-quality/ports/recordQualityReviewRepository';

export type RecordQualityReviewDecisionActionInput = {
  readonly repository: RecordQualityReviewRepository;
  readonly recordId: RecordQualityReviewRecordId;
  readonly updatedAt: string;
};

export type ReviseRecordQualityReviewDecisionInput =
  RecordQualityReviewDecisionActionInput &
    Omit<ReviseRecordQualityReviewDraftInput, 'updatedAt'>;

export async function acceptRecordQualityReviewDecision(
  input: RecordQualityReviewDecisionActionInput,
): Promise<RecordQualityReviewDraft> {
  const review = await getExistingReview(input.repository, input.recordId);
  return input.repository.updateReview(
    acceptRecordQualityReviewDraft(review, input.updatedAt),
  );
}

export async function reviseRecordQualityReviewDecision(
  input: ReviseRecordQualityReviewDecisionInput,
): Promise<RecordQualityReviewDraft> {
  const review = await getExistingReview(input.repository, input.recordId);
  return input.repository.updateReview(
    reviseRecordQualityReviewDraft(review, {
      suggestedCategories: input.suggestedCategories,
      missingInformationHints: input.missingInformationHints,
      notes: input.notes,
      updatedAt: input.updatedAt,
    }),
  );
}

export async function discardRecordQualityReviewDecision(
  input: RecordQualityReviewDecisionActionInput,
): Promise<RecordQualityReviewDraft> {
  const review = await getExistingReview(input.repository, input.recordId);
  return input.repository.updateReview(
    discardRecordQualityReviewDraft(review, input.updatedAt),
  );
}

async function getExistingReview(
  repository: RecordQualityReviewRepository,
  recordId: RecordQualityReviewRecordId,
): Promise<RecordQualityReviewDraft> {
  const review = await repository.getReview(recordId);
  if (!review) {
    throw new Error(`Record quality review not found: ${recordId}`);
  }

  return review;
}
