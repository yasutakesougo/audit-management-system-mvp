export {
  CASE_RECORD_CATEGORY_LABELS,
  accessScopeSchema,
  accessScopeValues,
  caseAccessPolicySchema,
  caseDocumentSchema,
  caseRecordCategorySchema,
  caseRecordCategoryValues,
  caseRecordSchema,
  caseRecordStatusSchema,
  caseRecordStatusValues,
  documentSensitivitySchema,
  documentSensitivityValues,
  documentStorageClassSchema,
  documentStorageClassValues,
  supportCaseSchema,
  supportCaseStatusSchema,
  supportCaseStatusValues,
} from './schema';

export type {
  CaseAccessPolicy,
  CaseDocument,
  CaseRecord,
  CaseRecordCategory,
  DocumentSensitivity,
  SupportCase,
  SupportCaseStatus,
} from './schema';

export {
  isOpenSupportCaseStatus,
  toSupportCaseSummary,
} from './repository';

export type {
  AddDocumentReferenceInput,
  AddRestrictedPersonalDocumentInput,
  CreateSupportCaseInput,
  SupportCaseId,
  SupportCaseRepository,
  SupportCaseSummary,
  UpdateSupportCaseInput,
} from './repository';

export {
  InMemorySupportCaseRepository,
} from './InMemorySupportCaseRepository';

export type {
  InMemorySupportCaseRepositoryOptions,
  InMemorySupportCaseRepositorySeed,
} from './InMemorySupportCaseRepository';

export {
  SUPPORT_CASE_DOCUMENTS_LIST_TITLE,
  SUPPORT_CASE_EVENTS_LIST_TITLE,
  SUPPORT_CASE_RECORDS_LIST_TITLE,
  SUPPORT_CASES_LIST_TITLE,
  documentLibraryTargetSchema,
  documentLibraryTargetValues,
  supportCaseAuditEventSchema,
  supportCaseDocumentListItemSchema,
  supportCaseEventActionSchema,
  supportCaseEventActionValues,
  supportCaseEventListItemSchema,
  supportCaseEventTargetTypeSchema,
  supportCaseEventTargetTypeValues,
  supportCaseListItemSchema,
  supportCaseRecordListItemSchema,
} from './sharePointProjection';

export type {
  DocumentLibraryTarget,
  SupportCaseAuditEvent,
  SupportCaseDocumentListItem,
  SupportCaseEventAction,
  SupportCaseEventListItem,
  SupportCaseEventTargetType,
  SupportCaseListItem,
  SupportCaseRecordListItem,
} from './sharePointProjection';

export {
  toRestrictedDocumentListItem,
  toStandardDocumentListItem,
  toSupportCaseEventListItem,
  toSupportCaseListItem,
  toSupportCaseRecordListItem,
} from './sharePointMapper';

export {
  SharePointSupportCaseRepository,
  SupportCaseRepositoryError,
} from './SharePointSupportCaseRepository';

export type {
  SharePointSupportCaseRepositoryOptions,
} from './SharePointSupportCaseRepository';
