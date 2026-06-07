import { z } from 'zod';
import {
  caseRecordCategorySchema,
  caseRecordStatusSchema,
  documentSensitivitySchema,
  supportCaseStatusSchema,
} from './schema';

const requiredText = z.string().min(1);
const nullableText = requiredText.nullable();
const isoDate = z.string().date();
const isoDateTime = z.string().datetime({ offset: true });

export const SUPPORT_CASES_LIST_TITLE = 'SupportCases' as const;
export const SUPPORT_CASE_RECORDS_LIST_TITLE = 'SupportCaseRecords' as const;
export const SUPPORT_CASE_DOCUMENTS_LIST_TITLE = 'SupportCaseDocuments' as const;
export const SUPPORT_CASE_EVENTS_LIST_TITLE = 'SupportCaseEvents' as const;

export const supportCaseListItemSchema = z.object({
  Title: requiredText,
  CaseId: requiredText,
  TenantId: requiredText,
  UserId: requiredText,
  ServiceType: requiredText,
  Status: supportCaseStatusSchema,
  OpenedOn: isoDate,
  ClosedOn: isoDate.nullable(),
  PrimaryStaffId: requiredText,
  CreatedAt: isoDateTime,
  CreatedByKey: requiredText,
  UpdatedAt: isoDateTime,
  UpdatedByKey: requiredText,
});

export type SupportCaseListItem = z.infer<typeof supportCaseListItemSchema>;

export const documentLibraryTargetValues = [
  'standard_documents',
  'restricted_personal_documents',
] as const;

export const documentLibraryTargetSchema = z.enum(documentLibraryTargetValues);
export type DocumentLibraryTarget = z.infer<typeof documentLibraryTargetSchema>;

export const supportCaseDocumentListItemSchema = z.object({
  Title: requiredText,
  DocumentId: requiredText,
  TenantId: requiredText,
  SupportCaseId: requiredText,
  CaseRecordId: nullableText,
  Category: caseRecordCategorySchema,
  FileName: requiredText,
  StoragePolicy: z.enum(['standard_library', 'restricted_library']),
  LibraryTarget: documentLibraryTargetSchema,
  StorageLocator: requiredText,
  Sensitivity: documentSensitivitySchema,
  AuditLogRequired: z.boolean(),
  TemplateKey: nullableText,
  TemplateVersion: nullableText,
  CreatedAt: isoDateTime,
  CreatedByKey: requiredText,
}).superRefine((value, ctx) => {
  if (value.Category === 'personal_information') {
    if (value.StoragePolicy !== 'restricted_library') {
      ctx.addIssue({
        code: 'custom',
        path: ['StoragePolicy'],
        message: '個人情報書類はrestricted_libraryへ投影してください',
      });
    }
    if (value.LibraryTarget !== 'restricted_personal_documents') {
      ctx.addIssue({
        code: 'custom',
        path: ['LibraryTarget'],
        message: '個人情報書類は制限付きライブラリへ投影してください',
      });
    }
    if (!value.AuditLogRequired) {
      ctx.addIssue({
        code: 'custom',
        path: ['AuditLogRequired'],
        message: '個人情報書類の投影には監査ログが必要です',
      });
    }
  }
});

export type SupportCaseDocumentListItem = z.infer<
  typeof supportCaseDocumentListItemSchema
>;

export const supportCaseEventActionValues = [
  'created',
  'updated',
  'viewed',
  'downloaded',
  'archived',
] as const;

export const supportCaseEventActionSchema = z.enum(supportCaseEventActionValues);
export type SupportCaseEventAction = z.infer<typeof supportCaseEventActionSchema>;

export const supportCaseEventTargetTypeValues = [
  'support_case',
  'case_record',
  'case_document',
] as const;

export const supportCaseEventTargetTypeSchema = z.enum(
  supportCaseEventTargetTypeValues,
);
export type SupportCaseEventTargetType = z.infer<
  typeof supportCaseEventTargetTypeSchema
>;

export const supportCaseAuditEventSchema = z.object({
  id: requiredText,
  tenantId: requiredText,
  supportCaseId: requiredText,
  targetType: supportCaseEventTargetTypeSchema,
  targetId: requiredText,
  action: supportCaseEventActionSchema,
  actorId: requiredText,
  occurredAt: isoDateTime,
  auditLogRequired: z.literal(true),
  detailJson: z.string().nullable().default(null),
});

export type SupportCaseAuditEvent = z.infer<typeof supportCaseAuditEventSchema>;

export const supportCaseEventListItemSchema = z.object({
  Title: requiredText,
  EventId: requiredText,
  TenantId: requiredText,
  SupportCaseId: requiredText,
  TargetType: supportCaseEventTargetTypeSchema,
  TargetId: requiredText,
  Action: supportCaseEventActionSchema,
  ActorId: requiredText,
  OccurredAt: isoDateTime,
  AuditLogRequired: z.literal(true),
  DetailJson: z.string().nullable(),
});

export type SupportCaseEventListItem = z.infer<
  typeof supportCaseEventListItemSchema
>;

/**
 * Reserved projection for the seven-category record index.
 * It is defined here so a future adapter does not need to invent field names.
 */
export const supportCaseRecordListItemSchema = z.object({
  Title: requiredText,
  RecordId: requiredText,
  TenantId: requiredText,
  SupportCaseId: requiredText,
  UserId: requiredText,
  Category: caseRecordCategorySchema,
  OccurredOn: isoDate,
  Status: caseRecordStatusSchema,
  SourceModule: requiredText,
  SourceRecordId: requiredText,
  RelatedPlanId: nullableText,
  CreatedAt: isoDateTime,
  CreatedByKey: requiredText,
  UpdatedAt: isoDateTime,
  UpdatedByKey: requiredText,
});

export type SupportCaseRecordListItem = z.infer<
  typeof supportCaseRecordListItemSchema
>;
