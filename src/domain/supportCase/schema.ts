import { z } from 'zod';

const isoDate = z.string().date();
const isoDateTime = z.string().datetime({ offset: true });

export const supportCaseStatusValues = ['active', 'suspended', 'closed'] as const;
export const supportCaseStatusSchema = z.enum(supportCaseStatusValues);
export type SupportCaseStatus = z.infer<typeof supportCaseStatusSchema>;

/**
 * A tenant-scoped container that ties existing welfare modules to one service user.
 * Detailed user attributes remain in Users_Master and are not duplicated here.
 */
export const supportCaseSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  userId: z.string().min(1),
  serviceType: z.string().min(1),
  status: supportCaseStatusSchema,
  openedOn: isoDate,
  closedOn: isoDate.nullable().default(null),
  primaryStaffId: z.string().min(1),
  createdAt: isoDateTime,
  createdBy: z.string().min(1),
  updatedAt: isoDateTime,
  updatedBy: z.string().min(1),
}).superRefine((value, ctx) => {
  if (value.status === 'closed' && value.closedOn === null) {
    ctx.addIssue({
      code: 'custom',
      path: ['closedOn'],
      message: '終了したケースには終了日が必要です',
    });
  }
  if (value.status !== 'closed' && value.closedOn !== null) {
    ctx.addIssue({
      code: 'custom',
      path: ['closedOn'],
      message: '終了日を設定できるのは終了したケースのみです',
    });
  }
});

export type SupportCase = z.infer<typeof supportCaseSchema>;

export const caseRecordCategoryValues = [
  'individual_support_plan',
  'monitoring_review',
  'user_family_intention',
  'service_team_meeting',
  'assessment',
  'personal_information',
  'template_consent',
] as const;

export const caseRecordCategorySchema = z.enum(caseRecordCategoryValues);
export type CaseRecordCategory = z.infer<typeof caseRecordCategorySchema>;

export const CASE_RECORD_CATEGORY_LABELS: Record<CaseRecordCategory, string> = {
  individual_support_plan: '個別支援計画',
  monitoring_review: '計画の進捗と見直し',
  user_family_intention: '利用者・家族の意見',
  service_team_meeting: 'サービス担当者会議',
  assessment: 'アセスメント記録',
  personal_information: '個人情報書類',
  template_consent: 'テンプレート・承諾書',
};

export const caseRecordStatusValues = ['draft', 'final', 'superseded', 'archived'] as const;
export const caseRecordStatusSchema = z.enum(caseRecordStatusValues);

/**
 * Cross-module index entry. The actual domain payload remains in its owning module.
 * For example, an ISP record points to ISP_Master through sourceRecordId.
 */
export const caseRecordSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  supportCaseId: z.string().min(1),
  userId: z.string().min(1),
  category: caseRecordCategorySchema,
  title: z.string().min(1).max(200),
  occurredOn: isoDate,
  status: caseRecordStatusSchema,
  sourceModule: z.string().min(1),
  sourceRecordId: z.string().min(1),
  relatedPlanId: z.string().min(1).nullable().default(null),
  createdAt: isoDateTime,
  createdBy: z.string().min(1),
  updatedAt: isoDateTime,
  updatedBy: z.string().min(1),
});

export type CaseRecord = z.infer<typeof caseRecordSchema>;

export const documentSensitivityValues = ['standard', 'confidential', 'restricted'] as const;
export const documentSensitivitySchema = z.enum(documentSensitivityValues);
export type DocumentSensitivity = z.infer<typeof documentSensitivitySchema>;

export const documentStorageClassValues = ['standard_library', 'restricted_library'] as const;
export const documentStorageClassSchema = z.enum(documentStorageClassValues);

/**
 * Metadata-only document reference. File bodies stay in SharePoint document libraries.
 */
export const caseDocumentSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  supportCaseId: z.string().min(1).nullable(),
  caseRecordId: z.string().min(1).nullable(),
  category: caseRecordCategorySchema,
  fileName: z.string().min(1),
  storageClass: documentStorageClassSchema,
  storageLocator: z.string().min(1),
  sensitivity: documentSensitivitySchema,
  auditLoggingRequired: z.boolean(),
  templateKey: z.string().min(1).nullable().default(null),
  templateVersion: z.string().min(1).nullable().default(null),
  createdAt: isoDateTime,
  createdBy: z.string().min(1),
}).superRefine((value, ctx) => {
  if (value.supportCaseId === null && value.category !== 'template_consent') {
    ctx.addIssue({
      code: 'custom',
      path: ['supportCaseId'],
      message: '利用者文書には支援ケースIDが必要です',
    });
  }

  if (value.category === 'personal_information') {
    if (value.sensitivity !== 'restricted') {
      ctx.addIssue({
        code: 'custom',
        path: ['sensitivity'],
        message: '個人情報書類はrestrictedに分類してください',
      });
    }
    if (value.storageClass !== 'restricted_library') {
      ctx.addIssue({
        code: 'custom',
        path: ['storageClass'],
        message: '個人情報書類は隔離ライブラリに保管してください',
      });
    }
    if (!value.auditLoggingRequired) {
      ctx.addIssue({
        code: 'custom',
        path: ['auditLoggingRequired'],
        message: '個人情報書類には監査ログが必要です',
      });
    }
  }
});

export type CaseDocument = z.infer<typeof caseDocumentSchema>;

export const accessScopeValues = ['tenant', 'case_team', 'privacy_officers'] as const;
export const accessScopeSchema = z.enum(accessScopeValues);

export const caseAccessPolicySchema = z.object({
  tenantId: z.string().min(1),
  supportCaseId: z.string().min(1),
  category: caseRecordCategorySchema,
  readScope: accessScopeSchema,
  writeScope: accessScopeSchema,
  exportAllowed: z.boolean(),
  auditLoggingRequired: z.boolean(),
}).superRefine((value, ctx) => {
  if (value.category !== 'personal_information') return;

  if (value.readScope !== 'privacy_officers' || value.writeScope !== 'privacy_officers') {
    ctx.addIssue({
      code: 'custom',
      path: ['readScope'],
      message: '個人情報書類は個人情報取扱権限に限定してください',
    });
  }
  if (value.exportAllowed) {
    ctx.addIssue({
      code: 'custom',
      path: ['exportAllowed'],
      message: '個人情報書類の標準エクスポートは許可できません',
    });
  }
  if (!value.auditLoggingRequired) {
    ctx.addIssue({
      code: 'custom',
      path: ['auditLoggingRequired'],
      message: '個人情報書類には監査ログが必要です',
    });
  }
});

export type CaseAccessPolicy = z.infer<typeof caseAccessPolicySchema>;
