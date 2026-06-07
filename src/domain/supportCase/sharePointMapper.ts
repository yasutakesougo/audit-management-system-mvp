import {
  caseDocumentSchema,
  caseRecordSchema,
  supportCaseSchema,
  type CaseDocument,
  type CaseRecord,
  type SupportCase,
} from './schema';
import {
  supportCaseAuditEventSchema,
  supportCaseDocumentListItemSchema,
  supportCaseEventListItemSchema,
  supportCaseListItemSchema,
  supportCaseRecordListItemSchema,
  type SupportCaseAuditEvent,
  type SupportCaseDocumentListItem,
  type SupportCaseEventListItem,
  type SupportCaseListItem,
  type SupportCaseRecordListItem,
} from './sharePointProjection';

export function toSupportCaseListItem(
  value: SupportCase,
): SupportCaseListItem {
  const supportCase = supportCaseSchema.parse(value);
  return supportCaseListItemSchema.parse({
    Title: `${supportCase.userId}:${supportCase.id}`,
    CaseId: supportCase.id,
    TenantId: supportCase.tenantId,
    UserId: supportCase.userId,
    ServiceType: supportCase.serviceType,
    Status: supportCase.status,
    OpenedOn: supportCase.openedOn,
    ClosedOn: supportCase.closedOn,
    PrimaryStaffId: supportCase.primaryStaffId,
    CreatedAt: supportCase.createdAt,
    CreatedByKey: supportCase.createdBy,
    UpdatedAt: supportCase.updatedAt,
    UpdatedByKey: supportCase.updatedBy,
  });
}

export function toSupportCaseRecordListItem(
  value: CaseRecord,
): SupportCaseRecordListItem {
  const record = caseRecordSchema.parse(value);
  return supportCaseRecordListItemSchema.parse({
    Title: record.title,
    RecordId: record.id,
    TenantId: record.tenantId,
    SupportCaseId: record.supportCaseId,
    UserId: record.userId,
    Category: record.category,
    OccurredOn: record.occurredOn,
    Status: record.status,
    SourceModule: record.sourceModule,
    SourceRecordId: record.sourceRecordId,
    RelatedPlanId: record.relatedPlanId,
    CreatedAt: record.createdAt,
    CreatedByKey: record.createdBy,
    UpdatedAt: record.updatedAt,
    UpdatedByKey: record.updatedBy,
  });
}

export function toStandardDocumentListItem(
  value: CaseDocument,
): SupportCaseDocumentListItem {
  const document = caseDocumentSchema.parse(value);
  if (document.category === 'personal_information') {
    throw new Error(
      'Personal information documents cannot be projected to the standard library',
    );
  }
  if (document.supportCaseId === null) {
    throw new Error('Standard document projection requires a support case id');
  }
  if (document.storageClass !== 'standard_library') {
    throw new Error('Standard document projection requires standard_library');
  }

  return supportCaseDocumentListItemSchema.parse({
    Title: document.fileName,
    DocumentId: document.id,
    TenantId: document.tenantId,
    SupportCaseId: document.supportCaseId,
    CaseRecordId: document.caseRecordId,
    Category: document.category,
    FileName: document.fileName,
    StoragePolicy: document.storageClass,
    LibraryTarget: 'standard_documents',
    StorageLocator: document.storageLocator,
    Sensitivity: document.sensitivity,
    AuditLogRequired: document.auditLoggingRequired,
    TemplateKey: document.templateKey,
    TemplateVersion: document.templateVersion,
    CreatedAt: document.createdAt,
    CreatedByKey: document.createdBy,
  });
}

export function toRestrictedDocumentListItem(
  value: CaseDocument,
): SupportCaseDocumentListItem {
  const document = caseDocumentSchema.parse(value);
  if (document.category !== 'personal_information') {
    throw new Error(
      'Restricted document projection accepts personal information documents only',
    );
  }
  if (document.supportCaseId === null) {
    throw new Error('Restricted document projection requires a support case id');
  }

  return supportCaseDocumentListItemSchema.parse({
    Title: document.fileName,
    DocumentId: document.id,
    TenantId: document.tenantId,
    SupportCaseId: document.supportCaseId,
    CaseRecordId: document.caseRecordId,
    Category: document.category,
    FileName: document.fileName,
    StoragePolicy: document.storageClass,
    LibraryTarget: 'restricted_personal_documents',
    StorageLocator: document.storageLocator,
    Sensitivity: document.sensitivity,
    AuditLogRequired: document.auditLoggingRequired,
    TemplateKey: document.templateKey,
    TemplateVersion: document.templateVersion,
    CreatedAt: document.createdAt,
    CreatedByKey: document.createdBy,
  });
}

export function toSupportCaseEventListItem(
  value: SupportCaseAuditEvent,
): SupportCaseEventListItem {
  const event = supportCaseAuditEventSchema.parse(value);
  return supportCaseEventListItemSchema.parse({
    Title: `${event.action}:${event.targetType}:${event.targetId}`,
    EventId: event.id,
    TenantId: event.tenantId,
    SupportCaseId: event.supportCaseId,
    TargetType: event.targetType,
    TargetId: event.targetId,
    Action: event.action,
    ActorId: event.actorId,
    OccurredAt: event.occurredAt,
    AuditLogRequired: event.auditLogRequired,
    DetailJson: event.detailJson,
  });
}
