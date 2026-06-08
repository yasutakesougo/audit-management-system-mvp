import type { SpFieldDef } from '@/lib/sp/types';
import {
  SUPPORT_CASE_DOCUMENTS_LIST_TITLE,
  SUPPORT_CASE_EVENTS_LIST_TITLE,
  SUPPORT_CASES_LIST_TITLE,
} from '@/domain/supportCase/sharePointProjection';

export {
  SUPPORT_CASE_DOCUMENTS_LIST_TITLE,
  SUPPORT_CASE_EVENTS_LIST_TITLE,
  SUPPORT_CASES_LIST_TITLE,
};

export const SUPPORT_CASE_RESTRICTED_DOCUMENTS_LIBRARY_TITLE =
  'SupportCaseRestrictedDocuments' as const;

export const SUPPORT_CASES_CANDIDATES = {
  caseId: ['CaseId', 'Case_x0020_ID', 'caseId', 'cr013_caseId'],
  tenantId: ['TenantId', 'Tenant_x0020_ID', 'tenantId', 'cr013_tenantId'],
  userId: ['UserId', 'User_x0020_ID', 'UserID', 'userId', 'cr013_userId'],
  serviceType: ['ServiceType', 'Service_x0020_Type', 'serviceType'],
  status: ['Status', 'CaseStatus', 'status'],
  openedOn: ['OpenedOn', 'Opened_x0020_On', 'openedOn'],
  closedOn: ['ClosedOn', 'Closed_x0020_On', 'closedOn'],
  primaryStaffId: [
    'PrimaryStaffId',
    'Primary_x0020_Staff_x0020_ID',
    'primaryStaffId',
  ],
  createdAt: ['CreatedAt', 'Created_x0020_At', 'createdAt'],
  createdByKey: ['CreatedByKey', 'Created_x0020_By_x0020_Key', 'createdBy'],
  updatedAt: ['UpdatedAt', 'Updated_x0020_At', 'updatedAt'],
  updatedByKey: ['UpdatedByKey', 'Updated_x0020_By_x0020_Key', 'updatedBy'],
  isDeleted: ['IsDeleted', 'Is_x0020_Deleted', 'isDeleted'],
} as const;

export const SUPPORT_CASE_DOCUMENTS_CANDIDATES = {
  documentId: ['DocumentId', 'Document_x0020_ID', 'documentId', 'cr013_documentId'],
  tenantId: ['TenantId', 'Tenant_x0020_ID', 'tenantId', 'cr013_tenantId'],
  caseId: ['SupportCaseId', 'Support_x0020_Case_x0020_ID', 'CaseId', 'caseId'],
  caseRecordId: ['CaseRecordId', 'Case_x0020_Record_x0020_ID', 'caseRecordId'],
  documentCategory: ['Category', 'DocumentCategory', 'Document_x0020_Category'],
  fileName: ['FileName', 'File_x0020_Name', 'FileLeafRef'],
  storagePolicy: ['StoragePolicy', 'Storage_x0020_Policy', 'storagePolicy'],
  libraryTarget: ['LibraryTarget', 'Library_x0020_Target', 'libraryTarget'],
  storageLocator: ['StorageLocator', 'Storage_x0020_Locator', 'storageLocator'],
  sensitivity: ['Sensitivity', 'DocumentSensitivity', 'sensitivity'],
  auditLogRequired: [
    'AuditLogRequired',
    'Audit_x0020_Log_x0020_Required',
    'auditLogRequired',
  ],
  templateKey: ['TemplateKey', 'Template_x0020_Key', 'templateKey'],
  templateVersion: [
    'TemplateVersion',
    'Template_x0020_Version',
    'templateVersion',
  ],
  createdAt: ['CreatedAt', 'Created_x0020_At', 'createdAt'],
  createdByKey: ['CreatedByKey', 'Created_x0020_By_x0020_Key', 'createdBy'],
  source: ['Source', 'DocumentSource', 'source'],
  isDeleted: ['IsDeleted', 'Is_x0020_Deleted', 'isDeleted'],
} as const;

export const SUPPORT_CASE_EVENTS_CANDIDATES = {
  eventId: ['EventId', 'Event_x0020_ID', 'eventId', 'cr013_eventId'],
  tenantId: ['TenantId', 'Tenant_x0020_ID', 'tenantId', 'cr013_tenantId'],
  caseId: ['SupportCaseId', 'Support_x0020_Case_x0020_ID', 'CaseId', 'caseId'],
  targetType: ['TargetType', 'Target_x0020_Type', 'targetType'],
  targetId: ['TargetId', 'Target_x0020_ID', 'targetId'],
  eventType: ['Action', 'EventType', 'Event_x0020_Type', 'eventType'],
  actorId: ['ActorId', 'Actor_x0020_ID', 'actorId'],
  actorName: ['ActorName', 'Actor_x0020_Name', 'actorName'],
  occurredAt: ['OccurredAt', 'Occurred_x0020_At', 'occurredAt'],
  auditLogRequired: [
    'AuditLogRequired',
    'Audit_x0020_Log_x0020_Required',
    'auditLogRequired',
  ],
  source: ['Source', 'EventSource', 'source'],
  detailJson: ['DetailJson', 'Detail_x0020_JSON', 'detailJson'],
  isDeleted: ['IsDeleted', 'Is_x0020_Deleted', 'isDeleted'],
} as const;

export const SUPPORT_CASE_RESTRICTED_DOCUMENTS_CANDIDATES = {
  documentId: SUPPORT_CASE_DOCUMENTS_CANDIDATES.documentId,
  tenantId: SUPPORT_CASE_DOCUMENTS_CANDIDATES.tenantId,
  caseId: SUPPORT_CASE_DOCUMENTS_CANDIDATES.caseId,
  documentCategory: SUPPORT_CASE_DOCUMENTS_CANDIDATES.documentCategory,
  storagePolicy: SUPPORT_CASE_DOCUMENTS_CANDIDATES.storagePolicy,
  libraryTarget: SUPPORT_CASE_DOCUMENTS_CANDIDATES.libraryTarget,
  sensitivity: SUPPORT_CASE_DOCUMENTS_CANDIDATES.sensitivity,
  auditLogRequired: SUPPORT_CASE_DOCUMENTS_CANDIDATES.auditLogRequired,
  source: SUPPORT_CASE_DOCUMENTS_CANDIDATES.source,
  isDeleted: SUPPORT_CASE_DOCUMENTS_CANDIDATES.isDeleted,
} as const;

export const SUPPORT_CASES_ESSENTIAL_FIELDS = [
  'CaseId',
  'TenantId',
  'UserId',
  'Status',
] as const;

export const SUPPORT_CASE_DOCUMENTS_ESSENTIAL_FIELDS = [
  'DocumentId',
  'TenantId',
  'SupportCaseId',
  'Category',
  'StoragePolicy',
  'LibraryTarget',
  'Sensitivity',
  'AuditLogRequired',
] as const;

export const SUPPORT_CASE_EVENTS_ESSENTIAL_FIELDS = [
  'EventId',
  'TenantId',
  'SupportCaseId',
  'Action',
  'ActorId',
  'OccurredAt',
  'AuditLogRequired',
] as const;

export const SUPPORT_CASE_RESTRICTED_DOCUMENTS_ESSENTIAL_FIELDS = [
  'DocumentId',
  'TenantId',
  'SupportCaseId',
  'Category',
  'StoragePolicy',
  'LibraryTarget',
  'Sensitivity',
  'AuditLogRequired',
] as const;

export const SUPPORT_CASES_PROVISIONING_FIELDS = [
  { internalName: 'CaseId', type: 'Text', displayName: 'Case ID', required: true, indexed: true, candidates: SUPPORT_CASES_CANDIDATES.caseId },
  { internalName: 'TenantId', type: 'Text', displayName: 'Tenant ID', required: true, indexed: true, candidates: SUPPORT_CASES_CANDIDATES.tenantId },
  { internalName: 'UserId', type: 'Text', displayName: 'User ID', required: true, indexed: true, candidates: SUPPORT_CASES_CANDIDATES.userId },
  { internalName: 'ServiceType', type: 'Text', displayName: 'Service Type', required: true, candidates: SUPPORT_CASES_CANDIDATES.serviceType },
  { internalName: 'Status', type: 'Text', displayName: 'Status', required: true, candidates: SUPPORT_CASES_CANDIDATES.status },
  { internalName: 'OpenedOn', type: 'DateTime', displayName: 'Opened On', required: true, dateTimeFormat: 'DateOnly', indexed: true, candidates: SUPPORT_CASES_CANDIDATES.openedOn },
  { internalName: 'ClosedOn', type: 'DateTime', displayName: 'Closed On', dateTimeFormat: 'DateOnly', candidates: SUPPORT_CASES_CANDIDATES.closedOn },
  { internalName: 'PrimaryStaffId', type: 'Text', displayName: 'Primary Staff ID', required: true, candidates: SUPPORT_CASES_CANDIDATES.primaryStaffId },
  { internalName: 'CreatedAt', type: 'DateTime', displayName: 'Created At', required: true, candidates: SUPPORT_CASES_CANDIDATES.createdAt },
  { internalName: 'CreatedByKey', type: 'Text', displayName: 'Created By Key', required: true, candidates: SUPPORT_CASES_CANDIDATES.createdByKey },
  { internalName: 'UpdatedAt', type: 'DateTime', displayName: 'Updated At', required: true, candidates: SUPPORT_CASES_CANDIDATES.updatedAt },
  { internalName: 'UpdatedByKey', type: 'Text', displayName: 'Updated By Key', required: true, candidates: SUPPORT_CASES_CANDIDATES.updatedByKey },
  { internalName: 'IsDeleted', type: 'Boolean', displayName: 'Is Deleted', default: false, candidates: SUPPORT_CASES_CANDIDATES.isDeleted },
] as const satisfies readonly SpFieldDef[];

export const SUPPORT_CASE_DOCUMENTS_PROVISIONING_FIELDS = [
  { internalName: 'DocumentId', type: 'Text', displayName: 'Document ID', required: true, indexed: true, candidates: SUPPORT_CASE_DOCUMENTS_CANDIDATES.documentId },
  { internalName: 'TenantId', type: 'Text', displayName: 'Tenant ID', required: true, indexed: true, candidates: SUPPORT_CASE_DOCUMENTS_CANDIDATES.tenantId },
  { internalName: 'SupportCaseId', type: 'Text', displayName: 'Support Case ID', required: true, indexed: true, candidates: SUPPORT_CASE_DOCUMENTS_CANDIDATES.caseId },
  { internalName: 'CaseRecordId', type: 'Text', displayName: 'Case Record ID', indexed: true, candidates: SUPPORT_CASE_DOCUMENTS_CANDIDATES.caseRecordId },
  { internalName: 'Category', type: 'Text', displayName: 'Document Category', required: true, candidates: SUPPORT_CASE_DOCUMENTS_CANDIDATES.documentCategory },
  { internalName: 'FileName', type: 'Text', displayName: 'File Name', required: true, candidates: SUPPORT_CASE_DOCUMENTS_CANDIDATES.fileName },
  { internalName: 'StoragePolicy', type: 'Text', displayName: 'Storage Policy', required: true, candidates: SUPPORT_CASE_DOCUMENTS_CANDIDATES.storagePolicy },
  { internalName: 'LibraryTarget', type: 'Text', displayName: 'Library Target', required: true, candidates: SUPPORT_CASE_DOCUMENTS_CANDIDATES.libraryTarget },
  { internalName: 'StorageLocator', type: 'Note', displayName: 'Storage Locator', required: true, richText: false, candidates: SUPPORT_CASE_DOCUMENTS_CANDIDATES.storageLocator },
  { internalName: 'Sensitivity', type: 'Text', displayName: 'Sensitivity', required: true, candidates: SUPPORT_CASE_DOCUMENTS_CANDIDATES.sensitivity },
  { internalName: 'AuditLogRequired', type: 'Boolean', displayName: 'Audit Log Required', required: true, candidates: SUPPORT_CASE_DOCUMENTS_CANDIDATES.auditLogRequired },
  { internalName: 'TemplateKey', type: 'Text', displayName: 'Template Key', candidates: SUPPORT_CASE_DOCUMENTS_CANDIDATES.templateKey },
  { internalName: 'TemplateVersion', type: 'Text', displayName: 'Template Version', candidates: SUPPORT_CASE_DOCUMENTS_CANDIDATES.templateVersion },
  { internalName: 'CreatedAt', type: 'DateTime', displayName: 'Created At', required: true, candidates: SUPPORT_CASE_DOCUMENTS_CANDIDATES.createdAt },
  { internalName: 'CreatedByKey', type: 'Text', displayName: 'Created By Key', required: true, candidates: SUPPORT_CASE_DOCUMENTS_CANDIDATES.createdByKey },
  { internalName: 'Source', type: 'Text', displayName: 'Source', candidates: SUPPORT_CASE_DOCUMENTS_CANDIDATES.source },
  { internalName: 'IsDeleted', type: 'Boolean', displayName: 'Is Deleted', default: false, candidates: SUPPORT_CASE_DOCUMENTS_CANDIDATES.isDeleted },
] as const satisfies readonly SpFieldDef[];

export const SUPPORT_CASE_EVENTS_PROVISIONING_FIELDS = [
  { internalName: 'EventId', type: 'Text', displayName: 'Event ID', required: true, indexed: true, candidates: SUPPORT_CASE_EVENTS_CANDIDATES.eventId },
  { internalName: 'TenantId', type: 'Text', displayName: 'Tenant ID', required: true, indexed: true, candidates: SUPPORT_CASE_EVENTS_CANDIDATES.tenantId },
  { internalName: 'SupportCaseId', type: 'Text', displayName: 'Support Case ID', required: true, indexed: true, candidates: SUPPORT_CASE_EVENTS_CANDIDATES.caseId },
  { internalName: 'TargetType', type: 'Text', displayName: 'Target Type', required: true, candidates: SUPPORT_CASE_EVENTS_CANDIDATES.targetType },
  { internalName: 'TargetId', type: 'Text', displayName: 'Target ID', required: true, indexed: true, candidates: SUPPORT_CASE_EVENTS_CANDIDATES.targetId },
  { internalName: 'Action', type: 'Text', displayName: 'Event Type', required: true, candidates: SUPPORT_CASE_EVENTS_CANDIDATES.eventType },
  { internalName: 'ActorId', type: 'Text', displayName: 'Actor ID', required: true, candidates: SUPPORT_CASE_EVENTS_CANDIDATES.actorId },
  { internalName: 'ActorName', type: 'Text', displayName: 'Actor Name', candidates: SUPPORT_CASE_EVENTS_CANDIDATES.actorName },
  { internalName: 'OccurredAt', type: 'DateTime', displayName: 'Occurred At', required: true, indexed: true, candidates: SUPPORT_CASE_EVENTS_CANDIDATES.occurredAt },
  { internalName: 'AuditLogRequired', type: 'Boolean', displayName: 'Audit Log Required', required: true, default: true, candidates: SUPPORT_CASE_EVENTS_CANDIDATES.auditLogRequired },
  { internalName: 'Source', type: 'Text', displayName: 'Source', candidates: SUPPORT_CASE_EVENTS_CANDIDATES.source },
  { internalName: 'DetailJson', type: 'Note', displayName: 'Detail JSON', richText: false, candidates: SUPPORT_CASE_EVENTS_CANDIDATES.detailJson },
  { internalName: 'IsDeleted', type: 'Boolean', displayName: 'Is Deleted', default: false, candidates: SUPPORT_CASE_EVENTS_CANDIDATES.isDeleted },
] as const satisfies readonly SpFieldDef[];

export const SUPPORT_CASE_RESTRICTED_DOCUMENTS_PROVISIONING_FIELDS = [
  { internalName: 'DocumentId', type: 'Text', displayName: 'Document ID', required: true, indexed: true, candidates: SUPPORT_CASE_RESTRICTED_DOCUMENTS_CANDIDATES.documentId },
  { internalName: 'TenantId', type: 'Text', displayName: 'Tenant ID', required: true, indexed: true, candidates: SUPPORT_CASE_RESTRICTED_DOCUMENTS_CANDIDATES.tenantId },
  { internalName: 'SupportCaseId', type: 'Text', displayName: 'Support Case ID', required: true, indexed: true, candidates: SUPPORT_CASE_RESTRICTED_DOCUMENTS_CANDIDATES.caseId },
  { internalName: 'Category', type: 'Text', displayName: 'Document Category', required: true, default: 'personal_information', candidates: SUPPORT_CASE_RESTRICTED_DOCUMENTS_CANDIDATES.documentCategory },
  { internalName: 'StoragePolicy', type: 'Text', displayName: 'Storage Policy', required: true, default: 'restricted_library', candidates: SUPPORT_CASE_RESTRICTED_DOCUMENTS_CANDIDATES.storagePolicy },
  { internalName: 'LibraryTarget', type: 'Text', displayName: 'Library Target', required: true, default: 'restricted_personal_documents', candidates: SUPPORT_CASE_RESTRICTED_DOCUMENTS_CANDIDATES.libraryTarget },
  { internalName: 'Sensitivity', type: 'Text', displayName: 'Sensitivity', required: true, default: 'restricted', candidates: SUPPORT_CASE_RESTRICTED_DOCUMENTS_CANDIDATES.sensitivity },
  { internalName: 'AuditLogRequired', type: 'Boolean', displayName: 'Audit Log Required', required: true, default: true, candidates: SUPPORT_CASE_RESTRICTED_DOCUMENTS_CANDIDATES.auditLogRequired },
  { internalName: 'Source', type: 'Text', displayName: 'Source', candidates: SUPPORT_CASE_RESTRICTED_DOCUMENTS_CANDIDATES.source },
  { internalName: 'IsDeleted', type: 'Boolean', displayName: 'Is Deleted', default: false, candidates: SUPPORT_CASE_RESTRICTED_DOCUMENTS_CANDIDATES.isDeleted },
] as const satisfies readonly SpFieldDef[];
