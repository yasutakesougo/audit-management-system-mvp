import {
  SUPPORT_CASE_DOCUMENTS_ESSENTIAL_FIELDS,
  SUPPORT_CASE_DOCUMENTS_LIST_TITLE,
  SUPPORT_CASE_DOCUMENTS_PROVISIONING_FIELDS,
  SUPPORT_CASE_EVENTS_ESSENTIAL_FIELDS,
  SUPPORT_CASE_EVENTS_LIST_TITLE,
  SUPPORT_CASE_EVENTS_PROVISIONING_FIELDS,
  SUPPORT_CASE_RESTRICTED_DOCUMENTS_ESSENTIAL_FIELDS,
  SUPPORT_CASE_RESTRICTED_DOCUMENTS_LIBRARY_TITLE,
  SUPPORT_CASE_RESTRICTED_DOCUMENTS_PROVISIONING_FIELDS,
  SUPPORT_CASES_ESSENTIAL_FIELDS,
  SUPPORT_CASES_LIST_TITLE,
  SUPPORT_CASES_PROVISIONING_FIELDS,
} from '@/sharepoint/fields/supportCaseFields';
import { envOr } from '../spListRegistry.shared';
import type { SpListEntry } from '../spListRegistry.shared';

/**
 * SupportCase resources remain experimental until an environment explicitly
 * enables each definition. This keeps registry metadata available to
 * diagnostics/provisioning without creating lists during normal bootstrap.
 */
export const supportCaseListEntries: readonly SpListEntry[] = [
  {
    key: 'support_cases',
    displayName: '汎用支援ケース',
    resolve: () => envOr('VITE_SP_LIST_SUPPORT_CASES', SUPPORT_CASES_LIST_TITLE),
    operations: ['R', 'W'],
    category: 'other',
    lifecycle: 'experimental',
    essentialFields: SUPPORT_CASES_ESSENTIAL_FIELDS,
    provisioningFields: SUPPORT_CASES_PROVISIONING_FIELDS,
  },
  {
    key: 'support_case_documents',
    displayName: '汎用支援ケース文書索引',
    resolve: () =>
      envOr(
        'VITE_SP_LIST_SUPPORT_CASE_DOCUMENTS',
        SUPPORT_CASE_DOCUMENTS_LIST_TITLE,
      ),
    operations: ['R', 'W', 'D'],
    category: 'other',
    lifecycle: 'experimental',
    essentialFields: SUPPORT_CASE_DOCUMENTS_ESSENTIAL_FIELDS,
    provisioningFields: SUPPORT_CASE_DOCUMENTS_PROVISIONING_FIELDS,
  },
  {
    key: 'support_case_events',
    displayName: '汎用支援ケース監査イベント',
    resolve: () =>
      envOr('VITE_SP_LIST_SUPPORT_CASE_EVENTS', SUPPORT_CASE_EVENTS_LIST_TITLE),
    operations: ['R', 'W'],
    category: 'other',
    lifecycle: 'experimental',
    essentialFields: SUPPORT_CASE_EVENTS_ESSENTIAL_FIELDS,
    provisioningFields: SUPPORT_CASE_EVENTS_PROVISIONING_FIELDS,
  },
  {
    key: 'support_case_restricted_documents',
    displayName: '汎用支援ケース個人情報書類',
    resolve: () =>
      envOr(
        'VITE_SP_LIBRARY_SUPPORT_CASE_RESTRICTED_DOCUMENTS',
        SUPPORT_CASE_RESTRICTED_DOCUMENTS_LIBRARY_TITLE,
      ),
    operations: ['R', 'W'],
    category: 'other',
    lifecycle: 'experimental',
    baseTemplate: 101,
    essentialFields: SUPPORT_CASE_RESTRICTED_DOCUMENTS_ESSENTIAL_FIELDS,
    provisioningFields: SUPPORT_CASE_RESTRICTED_DOCUMENTS_PROVISIONING_FIELDS,
  },
];
