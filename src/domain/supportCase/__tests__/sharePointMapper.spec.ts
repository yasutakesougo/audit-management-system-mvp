import { describe, expect, it } from 'vitest';
import type { CaseDocument, CaseRecord, SupportCase } from '../schema';
import {
  toRestrictedDocumentListItem,
  toStandardDocumentListItem,
  toSupportCaseEventListItem,
  toSupportCaseListItem,
  toSupportCaseRecordListItem,
} from '../sharePointMapper';
import type { SupportCaseAuditEvent } from '../sharePointProjection';

const timestamp = '2026-06-07T12:00:00+09:00';

const supportCase: SupportCase = {
  id: 'case-1',
  tenantId: 'office-1',
  userId: 'U001',
  serviceType: 'daily_life_care',
  status: 'active',
  openedOn: '2026-04-01',
  closedOn: null,
  primaryStaffId: 'staff-1',
  createdAt: timestamp,
  createdBy: 'staff-1',
  updatedAt: timestamp,
  updatedBy: 'staff-1',
};

const standardDocument: CaseDocument = {
  id: 'doc-1',
  tenantId: 'office-1',
  supportCaseId: 'case-1',
  caseRecordId: 'record-1',
  category: 'assessment',
  fileName: 'assessment.pdf',
  storageClass: 'standard_library',
  storageLocator: 'standard-drive-item-id',
  sensitivity: 'confidential',
  auditLoggingRequired: true,
  templateKey: null,
  templateVersion: null,
  createdAt: timestamp,
  createdBy: 'staff-1',
};

const restrictedDocument: CaseDocument = {
  ...standardDocument,
  id: 'doc-2',
  caseRecordId: null,
  category: 'personal_information',
  fileName: 'certificate.pdf',
  storageClass: 'restricted_library',
  storageLocator: 'restricted-drive-item-id',
  sensitivity: 'restricted',
  auditLoggingRequired: true,
};

describe('SharePoint support case projection', () => {
  it('maps SupportCase to the SupportCases list shape', () => {
    expect(toSupportCaseListItem(supportCase)).toEqual({
      Title: 'U001:case-1',
      CaseId: 'case-1',
      TenantId: 'office-1',
      UserId: 'U001',
      ServiceType: 'daily_life_care',
      Status: 'active',
      OpenedOn: '2026-04-01',
      ClosedOn: null,
      PrimaryStaffId: 'staff-1',
      CreatedAt: timestamp,
      CreatedByKey: 'staff-1',
      UpdatedAt: timestamp,
      UpdatedByKey: 'staff-1',
    });
  });

  it('rejects a SupportCase projection without tenantId', () => {
    const invalid = { ...supportCase, tenantId: '' };
    expect(() => toSupportCaseListItem(invalid)).toThrow();
  });
});

describe('SharePoint case record projection', () => {
  it('maps the seven-category record index without embedding domain content', () => {
    const record: CaseRecord = {
      id: 'record-1',
      tenantId: 'office-1',
      supportCaseId: 'case-1',
      userId: 'U001',
      category: 'assessment',
      title: '初回アセスメント',
      occurredOn: '2026-04-01',
      status: 'final',
      sourceModule: 'assessment',
      sourceRecordId: 'assessment-1',
      relatedPlanId: null,
      createdAt: timestamp,
      createdBy: 'staff-1',
      updatedAt: timestamp,
      updatedBy: 'staff-1',
    };

    expect(toSupportCaseRecordListItem(record)).toMatchObject({
      RecordId: 'record-1',
      TenantId: 'office-1',
      SupportCaseId: 'case-1',
      Category: 'assessment',
      SourceRecordId: 'assessment-1',
    });
  });
});

describe('SharePoint document projection', () => {
  it('maps a standard document to the standard library target', () => {
    expect(toStandardDocumentListItem(standardDocument)).toMatchObject({
      DocumentId: 'doc-1',
      TenantId: 'office-1',
      SupportCaseId: 'case-1',
      StoragePolicy: 'standard_library',
      LibraryTarget: 'standard_documents',
      AuditLogRequired: true,
    });
  });

  it('prevents personal information from using the standard projection', () => {
    expect(() => toStandardDocumentListItem(restrictedDocument)).toThrow(
      'cannot be projected to the standard library',
    );
  });

  it('maps personal information only to the restricted target', () => {
    expect(toRestrictedDocumentListItem(restrictedDocument)).toMatchObject({
      DocumentId: 'doc-2',
      Category: 'personal_information',
      StoragePolicy: 'restricted_library',
      LibraryTarget: 'restricted_personal_documents',
      Sensitivity: 'restricted',
      AuditLogRequired: true,
    });
  });

  it('prevents non-personal information from using the restricted projection', () => {
    expect(() => toRestrictedDocumentListItem(standardDocument)).toThrow(
      'personal information documents only',
    );
  });

  it.each([
    ['tenantId', { ...standardDocument, tenantId: '' }],
    ['caseId', { ...standardDocument, supportCaseId: null }],
    ['storagePolicy', { ...standardDocument, storageClass: undefined }],
    ['auditLogRequired', { ...standardDocument, auditLoggingRequired: undefined }],
  ])('rejects a standard projection without %s', (_field, invalid) => {
    expect(() => toStandardDocumentListItem(invalid as CaseDocument)).toThrow();
  });

  it('rejects a restricted projection without auditLogRequired', () => {
    const invalid = {
      ...restrictedDocument,
      auditLoggingRequired: false,
    };
    expect(() => toRestrictedDocumentListItem(invalid)).toThrow();
  });
});

describe('SharePoint audit event projection', () => {
  const event: SupportCaseAuditEvent = {
    id: 'event-1',
    tenantId: 'office-1',
    supportCaseId: 'case-1',
    targetType: 'case_document',
    targetId: 'doc-2',
    action: 'viewed',
    actorId: 'privacy-officer-1',
    occurredAt: timestamp,
    auditLogRequired: true,
    detailJson: null,
  };

  it('maps an audit event to SupportCaseEvents', () => {
    expect(toSupportCaseEventListItem(event)).toEqual({
      Title: 'viewed:case_document:doc-2',
      EventId: 'event-1',
      TenantId: 'office-1',
      SupportCaseId: 'case-1',
      TargetType: 'case_document',
      TargetId: 'doc-2',
      Action: 'viewed',
      ActorId: 'privacy-officer-1',
      OccurredAt: timestamp,
      AuditLogRequired: true,
      DetailJson: null,
    });
  });

  it.each([
    ['tenantId', { ...event, tenantId: '' }],
    ['caseId', { ...event, supportCaseId: '' }],
    ['auditLogRequired', { ...event, auditLogRequired: false }],
  ])('rejects an audit event without a valid %s', (_field, invalid) => {
    expect(() =>
      toSupportCaseEventListItem(invalid as SupportCaseAuditEvent),
    ).toThrow();
  });
});
