import { describe, expect, it } from 'vitest';
import {
  caseAccessPolicySchema,
  caseDocumentSchema,
  caseRecordCategoryValues,
  supportCaseSchema,
} from '../schema';

const auditFields = {
  createdAt: '2026-06-07T01:00:00+09:00',
  createdBy: 'staff-1',
};

describe('supportCaseSchema', () => {
  it('requires a closed date when the case is closed', () => {
    const result = supportCaseSchema.safeParse({
      id: 'case-1',
      tenantId: 'office-1',
      userId: 'U001',
      serviceType: 'daily_life_care',
      status: 'closed',
      openedOn: '2026-04-01',
      closedOn: null,
      primaryStaffId: 'staff-1',
      ...auditFields,
      updatedAt: auditFields.createdAt,
      updatedBy: auditFields.createdBy,
    });

    expect(result.success).toBe(false);
  });
});
describe('caseRecordCategorySchema', () => {
  it('covers the seven SharePoint folder classifications', () => {
    expect(caseRecordCategoryValues).toEqual([
      'individual_support_plan',
      'monitoring_review',
      'user_family_intention',
      'service_team_meeting',
      'assessment',
      'personal_information',
      'template_consent',
    ]);
  });
});

describe('caseDocumentSchema', () => {
  it('accepts a personal information reference only with isolated storage and audit logging', () => {
    const result = caseDocumentSchema.safeParse({
      id: 'doc-1',
      tenantId: 'office-1',
      supportCaseId: 'case-1',
      caseRecordId: null,
      category: 'personal_information',
      fileName: 'certificate.pdf',
      storageClass: 'restricted_library',
      storageLocator: 'drive-item-id',
      sensitivity: 'restricted',
      auditLoggingRequired: true,
      ...auditFields,
    });

    expect(result.success).toBe(true);
  });

  it('rejects personal information stored in the standard library', () => {
    const result = caseDocumentSchema.safeParse({
      id: 'doc-1',
      tenantId: 'office-1',
      supportCaseId: 'case-1',
      caseRecordId: null,
      category: 'personal_information',
      fileName: 'certificate.pdf',
      storageClass: 'standard_library',
      storageLocator: 'drive-item-id',
      sensitivity: 'confidential',
      auditLoggingRequired: false,
      ...auditFields,
    });

    expect(result.success).toBe(false);
  });
});

describe('caseAccessPolicySchema', () => {
  it('prevents broad access and export for personal information', () => {
    const result = caseAccessPolicySchema.safeParse({
      tenantId: 'office-1',
      supportCaseId: 'case-1',
      category: 'personal_information',
      readScope: 'case_team',
      writeScope: 'case_team',
      exportAllowed: true,
      auditLoggingRequired: false,
    });

    expect(result.success).toBe(false);
  });
});
