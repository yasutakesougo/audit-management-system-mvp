import {
  RECORD_QUALITY_REVIEW_ESSENTIAL_FIELDS,
  RECORD_QUALITY_REVIEW_LIST_TITLE,
  RECORD_QUALITY_REVIEW_PROVISIONING_FIELDS,
} from '@/sharepoint/fields/recordQualityReviewFields';
import { envOr } from '../spListRegistry.shared';
import type { SpListEntry } from '../spListRegistry.shared';

export const recordQualityListEntries: readonly SpListEntry[] = [
  {
    key: 'record_quality_review',
    displayName: '記録品質レビュー',
    resolve: () =>
      envOr('VITE_SP_LIST_RECORD_QUALITY_REVIEW', RECORD_QUALITY_REVIEW_LIST_TITLE),
    operations: ['R', 'W'],
    category: 'other',
    lifecycle: 'optional',
    essentialFields: RECORD_QUALITY_REVIEW_ESSENTIAL_FIELDS,
    provisioningFields: RECORD_QUALITY_REVIEW_PROVISIONING_FIELDS,
  },
];
