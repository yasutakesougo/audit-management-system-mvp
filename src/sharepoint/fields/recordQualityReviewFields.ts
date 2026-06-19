import type { SpFieldDef } from '@/lib/sp/types';
import {
  RECORD_QUALITY_REVIEW_FIELDS,
  RECORD_QUALITY_REVIEW_LIST_TITLE,
} from '@/domain/supportRecord/dataProviderRecordQualityReviewPersistenceStore';

export { RECORD_QUALITY_REVIEW_LIST_TITLE };

export const RECORD_QUALITY_REVIEW_CANDIDATES = {
  recordId: [RECORD_QUALITY_REVIEW_FIELDS.recordId, 'Record_x0020_ID'],
  sourceRecordId: [
    RECORD_QUALITY_REVIEW_FIELDS.sourceRecordId,
    'Source_x0020_Record_x0020_ID',
  ],
  status: [RECORD_QUALITY_REVIEW_FIELDS.status, 'Review_x0020_Status'],
  reviewerId: [RECORD_QUALITY_REVIEW_FIELDS.reviewerId, 'Reviewer_x0020_ID'],
  reviewerName: [
    RECORD_QUALITY_REVIEW_FIELDS.reviewerName,
    'Reviewer_x0020_Name',
  ],
  suggestedCategoriesJson: [
    RECORD_QUALITY_REVIEW_FIELDS.suggestedCategoriesJson,
    'Suggested_x0020_Categories_x0020_JSON',
  ],
  missingInfoHintsJson: [
    RECORD_QUALITY_REVIEW_FIELDS.missingInfoHintsJson,
    'Missing_x0020_Info_x0020_Hints_x0020_JSON',
  ],
  reviewerNotesJson: [
    RECORD_QUALITY_REVIEW_FIELDS.reviewerNotesJson,
    'Reviewer_x0020_Notes_x0020_JSON',
  ],
  createdAt: [RECORD_QUALITY_REVIEW_FIELDS.createdAt, 'Created_x0020_At'],
  updatedAt: [RECORD_QUALITY_REVIEW_FIELDS.updatedAt, 'Updated_x0020_At'],
} as const;

export const RECORD_QUALITY_REVIEW_ESSENTIAL_FIELDS = [
  RECORD_QUALITY_REVIEW_FIELDS.recordId,
  RECORD_QUALITY_REVIEW_FIELDS.sourceRecordId,
  RECORD_QUALITY_REVIEW_FIELDS.status,
  RECORD_QUALITY_REVIEW_FIELDS.suggestedCategoriesJson,
  RECORD_QUALITY_REVIEW_FIELDS.missingInfoHintsJson,
  RECORD_QUALITY_REVIEW_FIELDS.reviewerNotesJson,
  RECORD_QUALITY_REVIEW_FIELDS.createdAt,
  RECORD_QUALITY_REVIEW_FIELDS.updatedAt,
] as const;

export const RECORD_QUALITY_REVIEW_PROVISIONING_FIELDS = [
  {
    internalName: RECORD_QUALITY_REVIEW_FIELDS.recordId,
    type: 'Text',
    displayName: 'Record ID',
    required: true,
    indexed: true,
    candidates: RECORD_QUALITY_REVIEW_CANDIDATES.recordId,
  },
  {
    internalName: RECORD_QUALITY_REVIEW_FIELDS.sourceRecordId,
    type: 'Text',
    displayName: 'Source Record ID',
    required: true,
    indexed: true,
    candidates: RECORD_QUALITY_REVIEW_CANDIDATES.sourceRecordId,
  },
  {
    internalName: RECORD_QUALITY_REVIEW_FIELDS.status,
    type: 'Choice',
    displayName: 'Review Status',
    required: true,
    indexed: true,
    choices: ['draft', 'accepted', 'revised', 'discarded'],
    default: 'draft',
    candidates: RECORD_QUALITY_REVIEW_CANDIDATES.status,
  },
  {
    internalName: RECORD_QUALITY_REVIEW_FIELDS.reviewerId,
    type: 'Text',
    displayName: 'Reviewer ID',
    candidates: RECORD_QUALITY_REVIEW_CANDIDATES.reviewerId,
  },
  {
    internalName: RECORD_QUALITY_REVIEW_FIELDS.reviewerName,
    type: 'Text',
    displayName: 'Reviewer Name',
    candidates: RECORD_QUALITY_REVIEW_CANDIDATES.reviewerName,
  },
  {
    internalName: RECORD_QUALITY_REVIEW_FIELDS.suggestedCategoriesJson,
    type: 'Note',
    displayName: 'Suggested Categories JSON',
    required: true,
    richText: false,
    candidates: RECORD_QUALITY_REVIEW_CANDIDATES.suggestedCategoriesJson,
  },
  {
    internalName: RECORD_QUALITY_REVIEW_FIELDS.missingInfoHintsJson,
    type: 'Note',
    displayName: 'Missing Info Hints JSON',
    required: true,
    richText: false,
    candidates: RECORD_QUALITY_REVIEW_CANDIDATES.missingInfoHintsJson,
  },
  {
    internalName: RECORD_QUALITY_REVIEW_FIELDS.reviewerNotesJson,
    type: 'Note',
    displayName: 'Reviewer Notes JSON',
    required: true,
    richText: false,
    candidates: RECORD_QUALITY_REVIEW_CANDIDATES.reviewerNotesJson,
  },
  {
    internalName: RECORD_QUALITY_REVIEW_FIELDS.createdAt,
    type: 'DateTime',
    displayName: 'Created At',
    required: true,
    dateTimeFormat: 'DateTime',
    candidates: RECORD_QUALITY_REVIEW_CANDIDATES.createdAt,
  },
  {
    internalName: RECORD_QUALITY_REVIEW_FIELDS.updatedAt,
    type: 'DateTime',
    displayName: 'Updated At',
    required: true,
    indexed: true,
    dateTimeFormat: 'DateTime',
    candidates: RECORD_QUALITY_REVIEW_CANDIDATES.updatedAt,
  },
] as const satisfies readonly SpFieldDef[];
