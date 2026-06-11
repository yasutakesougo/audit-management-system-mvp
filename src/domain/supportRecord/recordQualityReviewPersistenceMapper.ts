import {
  RECORD_QUALITY_REVIEW_SAFETY_METADATA,
  RECORD_QUALITY_REVIEW_STATUSES,
  type RecordQualityMissingInformationHint,
  type RecordQualityReviewDraft,
  type RecordQualityReviewSource,
  type RecordQualityReviewStatus,
  type RecordQualitySuggestedCategory,
} from './recordQualityReview';

export type RecordQualityReviewPersistenceItem = {
  readonly recordId: string;
  readonly sourceRecordId: string;
  readonly status: RecordQualityReviewStatus;
  readonly reviewerId?: string;
  readonly reviewerName?: string;
  readonly suggestedCategoriesJson: string;
  readonly missingInfoHintsJson: string;
  readonly reviewerNotesJson: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export function toRecordQualityReviewPersistenceItem(
  draft: RecordQualityReviewDraft,
): RecordQualityReviewPersistenceItem {
  return {
    recordId: draft.recordId,
    sourceRecordId: draft.originalRecord.recordId,
    status: assertRecordQualityReviewStatus(draft.status),
    reviewerId: readOptionalString(draft, 'reviewerId'),
    reviewerName: readOptionalString(draft, 'reviewerName'),
    suggestedCategoriesJson: JSON.stringify(draft.suggestedCategories.map(toSuggestedCategoryItem)),
    missingInfoHintsJson: JSON.stringify(draft.missingInformationHints.map(toMissingInfoHintItem)),
    reviewerNotesJson: JSON.stringify([...draft.notes]),
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

export function fromRecordQualityReviewPersistenceItem(
  item: RecordQualityReviewPersistenceItem,
): RecordQualityReviewDraft {
  return {
    ...RECORD_QUALITY_REVIEW_SAFETY_METADATA,
    recordId: item.recordId,
    originalRecord: {
      recordId: item.sourceRecordId,
    },
    status: assertRecordQualityReviewStatus(item.status),
    suggestedCategories: parseJsonArray<RecordQualitySuggestedCategory>(
      item.suggestedCategoriesJson,
      'suggestedCategoriesJson',
    ),
    missingInformationHints: parseJsonArray<RecordQualityMissingInformationHint>(
      item.missingInfoHintsJson,
      'missingInfoHintsJson',
    ),
    notes: parseJsonArray<string>(item.reviewerNotesJson, 'reviewerNotesJson'),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function toSuggestedCategoryItem(
  category: RecordQualitySuggestedCategory,
): RecordQualitySuggestedCategory {
  return {
    categoryId: category.categoryId,
    matchedSignals: [...category.matchedSignals],
    source: assertRecordQualityReviewSource(category.source),
  };
}

function toMissingInfoHintItem(
  hint: RecordQualityMissingInformationHint,
): RecordQualityMissingInformationHint {
  return {
    code: hint.code,
    label: hint.label,
    source: assertRecordQualityReviewSource(hint.source),
  };
}

function assertRecordQualityReviewStatus(status: string): RecordQualityReviewStatus {
  if (!(RECORD_QUALITY_REVIEW_STATUSES as readonly string[]).includes(status)) {
    throw new Error(`Unsupported record quality review status: ${status}`);
  }

  return status as RecordQualityReviewStatus;
}

function assertRecordQualityReviewSource(source: string): RecordQualityReviewSource {
  if (!['rule', 'ai', 'human'].includes(source)) {
    throw new Error(`Unsupported record quality review source: ${source}`);
  }

  return source as RecordQualityReviewSource;
}

function readOptionalString(source: object, key: string): string | undefined {
  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'string' && value ? value : undefined;
}

function parseJsonArray<T>(value: string, fieldName: string): readonly T[] {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) {
    throw new Error(`Record quality review persistence field must be an array: ${fieldName}`);
  }

  return parsed as readonly T[];
}
