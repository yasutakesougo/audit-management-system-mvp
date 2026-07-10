import type { MissingInformationCode, RecordQualityCategoryId } from '@/features/record-quality/domain/recordQuality';

export type RecordQualityReviewStatus = 'draft' | 'accepted' | 'revised' | 'discarded';

export type RecordQualityReviewSource = 'rule' | 'ai' | 'human';

export type RecordQualityOriginalRecordReference = {
  readonly recordId: string;
};

export type RecordQualitySuggestedCategory = {
  readonly categoryId: RecordQualityCategoryId;
  readonly matchedSignals: readonly string[];
  readonly source: RecordQualityReviewSource;
};

export type RecordQualityMissingInformationHint = {
  readonly code: MissingInformationCode;
  readonly label: string;
  readonly source: RecordQualityReviewSource;
};

export type RecordQualityReviewSafetyMetadata = {
  readonly sourceOfTruth: 'original_record';
  readonly outputKind: 'review_metadata';
  readonly requiresHumanReview: true;
  readonly prohibitedActions: readonly [
    'diagnose_users',
    'judge_behavior',
    'determine_support_policy',
    'overwrite_original_record',
  ];
};

export type RecordQualityReviewDraft = RecordQualityReviewSafetyMetadata & {
  readonly recordId: string;
  readonly originalRecord: RecordQualityOriginalRecordReference;
  readonly status: RecordQualityReviewStatus;
  readonly suggestedCategories: readonly RecordQualitySuggestedCategory[];
  readonly missingInformationHints: readonly RecordQualityMissingInformationHint[];
  readonly notes: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type CreateRecordQualityReviewDraftInput = {
  readonly recordId: string;
  readonly suggestedCategories?: readonly RecordQualitySuggestedCategory[];
  readonly missingInformationHints?: readonly RecordQualityMissingInformationHint[];
  readonly notes?: readonly string[];
  readonly createdAt: string;
  readonly updatedAt?: string;
};

export type ReviseRecordQualityReviewDraftInput = {
  readonly suggestedCategories?: readonly RecordQualitySuggestedCategory[];
  readonly missingInformationHints?: readonly RecordQualityMissingInformationHint[];
  readonly notes?: readonly string[];
  readonly updatedAt: string;
};

export const RECORD_QUALITY_REVIEW_SAFETY_METADATA: RecordQualityReviewSafetyMetadata = {
  sourceOfTruth: 'original_record',
  outputKind: 'review_metadata',
  requiresHumanReview: true,
  prohibitedActions: [
    'diagnose_users',
    'judge_behavior',
    'determine_support_policy',
    'overwrite_original_record',
  ],
};

export const RECORD_QUALITY_REVIEW_STATUSES = [
  'draft',
  'accepted',
  'revised',
  'discarded',
] as const satisfies readonly RecordQualityReviewStatus[];

export function createRecordQualityReviewDraft(
  input: CreateRecordQualityReviewDraftInput,
): RecordQualityReviewDraft {
  return {
    ...RECORD_QUALITY_REVIEW_SAFETY_METADATA,
    recordId: input.recordId,
    originalRecord: {
      recordId: input.recordId,
    },
    status: 'draft',
    suggestedCategories: [...(input.suggestedCategories ?? [])],
    missingInformationHints: [...(input.missingInformationHints ?? [])],
    notes: [...(input.notes ?? [])],
    createdAt: input.createdAt,
    updatedAt: input.updatedAt ?? input.createdAt,
  };
}

export function acceptRecordQualityReviewDraft(
  draft: RecordQualityReviewDraft,
  updatedAt: string,
): RecordQualityReviewDraft {
  return transitionRecordQualityReviewDraft(draft, 'accepted', { updatedAt });
}

export function reviseRecordQualityReviewDraft(
  draft: RecordQualityReviewDraft,
  input: ReviseRecordQualityReviewDraftInput,
): RecordQualityReviewDraft {
  return transitionRecordQualityReviewDraft(draft, 'revised', input);
}

export function discardRecordQualityReviewDraft(
  draft: RecordQualityReviewDraft,
  updatedAt: string,
): RecordQualityReviewDraft {
  return transitionRecordQualityReviewDraft(draft, 'discarded', { updatedAt });
}

function transitionRecordQualityReviewDraft(
  draft: RecordQualityReviewDraft,
  status: RecordQualityReviewStatus,
  input: ReviseRecordQualityReviewDraftInput,
): RecordQualityReviewDraft {
  assertRecordQualityReviewTransitionAllowed(draft.status, status);

  return {
    ...draft,
    ...RECORD_QUALITY_REVIEW_SAFETY_METADATA,
    recordId: draft.recordId,
    originalRecord: draft.originalRecord,
    status,
    suggestedCategories: input.suggestedCategories ?? draft.suggestedCategories,
    missingInformationHints: input.missingInformationHints ?? draft.missingInformationHints,
    notes: input.notes ?? draft.notes,
    createdAt: draft.createdAt,
    updatedAt: input.updatedAt,
  };
}

function assertRecordQualityReviewTransitionAllowed(
  currentStatus: RecordQualityReviewStatus,
  nextStatus: RecordQualityReviewStatus,
): void {
  if (currentStatus === 'accepted' || currentStatus === 'discarded') {
    throw new Error(
      `Cannot transition record quality review from ${currentStatus} to ${nextStatus}`,
    );
  }
}
