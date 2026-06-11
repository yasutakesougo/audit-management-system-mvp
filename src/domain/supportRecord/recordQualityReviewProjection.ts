import type {
  MissingInformationCheck,
  RecordQualityReviewDraft as RecordQualityClassificationDraft,
} from './recordQuality';
import {
  createRecordQualityReviewDraft,
  type RecordQualityReviewDraft,
  type RecordQualityReviewSource,
} from './recordQualityReview';

export type RecordQualityReviewProjectionSource = Exclude<RecordQualityReviewSource, 'human'>;

export type ProjectRecordQualityReviewDraftInput = {
  readonly classification: RecordQualityClassificationDraft;
  readonly createdAt: string;
  readonly source?: RecordQualityReviewProjectionSource;
  readonly notes?: readonly string[];
};

export function projectRecordQualityReviewDraft(
  input: ProjectRecordQualityReviewDraftInput,
): RecordQualityReviewDraft {
  const source = input.source ?? 'rule';

  return createRecordQualityReviewDraft({
    recordId: input.classification.recordId,
    suggestedCategories: input.classification.categoryCandidates.map(candidate => ({
      categoryId: candidate.categoryId,
      matchedSignals: [...candidate.matchedSignals],
      source,
    })),
    missingInformationHints: input.classification.missingInformation
      .filter(isMissingInformationHint)
      .map(check => ({
        code: check.code,
        label: check.label,
        source,
      })),
    notes: input.notes,
    createdAt: input.createdAt,
  });
}

function isMissingInformationHint(check: MissingInformationCheck): boolean {
  return !check.present;
}
