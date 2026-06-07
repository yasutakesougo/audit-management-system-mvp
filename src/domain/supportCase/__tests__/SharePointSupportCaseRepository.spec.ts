import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import {
  SharePointSupportCaseRepository,
  SupportCaseRepositoryError,
} from '../SharePointSupportCaseRepository';
import {
  SUPPORT_CASE_DOCUMENTS_LIST_TITLE,
  SUPPORT_CASE_EVENTS_LIST_TITLE,
  SUPPORT_CASES_LIST_TITLE,
} from '../sharePointProjection';

const timestamp = '2026-06-07T12:00:00+09:00';

const caseRow = {
  Id: 10,
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
};

const documentRow = {
  Id: 20,
  Title: 'assessment.pdf',
  DocumentId: 'document-1',
  TenantId: 'office-1',
  SupportCaseId: 'case-1',
  CaseRecordId: null,
  Category: 'assessment',
  FileName: 'assessment.pdf',
  StoragePolicy: 'standard_library',
  LibraryTarget: 'standard_documents',
  StorageLocator: 'standard-drive-item-id',
  Sensitivity: 'confidential',
  AuditLogRequired: true,
  TemplateKey: null,
  TemplateVersion: null,
  CreatedAt: timestamp,
  CreatedByKey: 'staff-1',
};

const makeProvider = (): Mocked<IDataProvider> => ({
  listItems: vi.fn(),
  getItemById: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  getMetadata: vi.fn(),
  getResourceNames: vi.fn(),
  getFieldInternalNames: vi.fn(),
  ensureListExists: vi.fn(),
  seed: vi.fn(),
});

describe('SharePointSupportCaseRepository', () => {
  let provider: Mocked<IDataProvider>;
  let repository: SharePointSupportCaseRepository;
  let nextId: number;

  beforeEach(() => {
    provider = makeProvider();
    nextId = 1;
    repository = new SharePointSupportCaseRepository({
      provider,
      now: () => timestamp,
      createId: (entity) => `${entity}-${nextId++}`,
    });
  });

  it('lists cases within the tenant boundary', async () => {
    provider.listItems.mockResolvedValue([
      caseRow,
      { ...caseRow, Id: 11, CaseId: 'case-2', TenantId: 'office-2' },
    ]);

    const result = await repository.listCases('office-1');

    expect(provider.listItems).toHaveBeenCalledWith(
      SUPPORT_CASES_LIST_TITLE,
      expect.objectContaining({
        filter: expect.stringContaining("TenantId eq 'office-1'"),
      }),
    );
    expect(result).toEqual([
      expect.objectContaining({
        id: 'case-1',
        tenantId: 'office-1',
        userId: 'U001',
      }),
    ]);
  });

  it('creates a case with the projection mapper', async () => {
    provider.createItem.mockResolvedValue({ Id: 11 });

    const created = await repository.createCase({
      tenantId: 'office-1',
      userId: 'U002',
      serviceType: 'daily_life_care',
      status: 'active',
      openedOn: '2026-06-01',
      closedOn: null,
      primaryStaffId: 'staff-2',
      createdBy: 'staff-2',
    });

    expect(provider.createItem).toHaveBeenCalledWith(
      SUPPORT_CASES_LIST_TITLE,
      expect.objectContaining({
        CaseId: 'case-1',
        TenantId: 'office-1',
        UserId: 'U002',
      }),
    );
    expect(created.id).toBe('case-1');
  });

  it('updates only a case matched by tenantId and caseId', async () => {
    provider.listItems.mockResolvedValue([caseRow]);
    provider.updateItem.mockResolvedValue({});

    const updated = await repository.updateCase('office-1', 'case-1', {
      status: 'closed',
      closedOn: '2026-06-07',
      updatedBy: 'staff-2',
    });

    expect(provider.listItems).toHaveBeenCalledWith(
      SUPPORT_CASES_LIST_TITLE,
      expect.objectContaining({
        filter: expect.stringContaining("TenantId eq 'office-1'"),
      }),
    );
    expect(provider.updateItem).toHaveBeenCalledWith(
      SUPPORT_CASES_LIST_TITLE,
      10,
      expect.objectContaining({
        CaseId: 'case-1',
        Status: 'closed',
        ClosedOn: '2026-06-07',
      }),
      { etag: '*' },
    );
    expect(updated.status).toBe('closed');
  });

  it('maps document list rows back to domain references', async () => {
    provider.listItems
      .mockResolvedValueOnce([caseRow])
      .mockResolvedValueOnce([
        documentRow,
        { ...documentRow, Id: 21, DocumentId: 'document-2', TenantId: 'office-2' },
      ]);

    const documents = await repository.listDocumentReferences(
      'office-1',
      'case-1',
    );

    expect(documents).toEqual([
      expect.objectContaining({
        id: 'document-1',
        category: 'assessment',
        storageClass: 'standard_library',
      }),
    ]);
  });

  it('stores a standard document without creating a restricted audit event', async () => {
    provider.listItems.mockResolvedValue([caseRow]);
    provider.createItem.mockResolvedValue({ Id: 21 });

    const document = await repository.addDocumentReference({
      tenantId: 'office-1',
      supportCaseId: 'case-1',
      caseRecordId: null,
      category: 'assessment',
      fileName: 'assessment.pdf',
      storageClass: 'standard_library',
      storageLocator: 'standard-drive-item-id',
      sensitivity: 'confidential',
      auditLoggingRequired: true,
      templateKey: null,
      templateVersion: null,
      createdBy: 'staff-1',
    });

    expect(provider.createItem).toHaveBeenCalledTimes(1);
    expect(provider.createItem).toHaveBeenCalledWith(
      SUPPORT_CASE_DOCUMENTS_LIST_TITLE,
      expect.objectContaining({
        Category: 'assessment',
        LibraryTarget: 'standard_documents',
      }),
    );
    expect(document.category).toBe('assessment');
  });

  it('stores restricted document metadata and its audit event', async () => {
    provider.listItems.mockResolvedValue([caseRow]);
    provider.createItem
      .mockResolvedValueOnce({ Id: 22 })
      .mockResolvedValueOnce({ Id: 23 });

    const document = await repository.addRestrictedPersonalDocument({
      tenantId: 'office-1',
      supportCaseId: 'case-1',
      caseRecordId: null,
      fileName: 'certificate.pdf',
      storageLocator: 'restricted-drive-item-id',
      templateKey: null,
      templateVersion: null,
      createdBy: 'privacy-officer-1',
    });

    expect(provider.createItem).toHaveBeenNthCalledWith(
      1,
      SUPPORT_CASE_DOCUMENTS_LIST_TITLE,
      expect.objectContaining({
        Category: 'personal_information',
        LibraryTarget: 'restricted_personal_documents',
        AuditLogRequired: true,
      }),
    );
    expect(provider.createItem).toHaveBeenNthCalledWith(
      2,
      SUPPORT_CASE_EVENTS_LIST_TITLE,
      expect.objectContaining({
        TargetType: 'case_document',
        TargetId: 'document-1',
        Action: 'created',
        AuditLogRequired: true,
      }),
    );
    expect(document.storageClass).toBe('restricted_library');
  });

  it('rolls back restricted metadata when audit event persistence fails', async () => {
    provider.listItems.mockResolvedValue([caseRow]);
    provider.createItem
      .mockResolvedValueOnce({ Id: 24 })
      .mockRejectedValueOnce(new Error('events list unavailable'));
    provider.deleteItem.mockResolvedValue();

    await expect(
      repository.addRestrictedPersonalDocument({
        tenantId: 'office-1',
        supportCaseId: 'case-1',
        caseRecordId: null,
        fileName: 'certificate.pdf',
        storageLocator: 'restricted-drive-item-id',
        templateKey: null,
        templateVersion: null,
        createdBy: 'privacy-officer-1',
      }),
    ).rejects.toMatchObject({
      operation: 'addRestrictedPersonalDocument',
    });

    expect(provider.deleteItem).toHaveBeenCalledWith(
      SUPPORT_CASE_DOCUMENTS_LIST_TITLE,
      24,
    );
  });

  it('finds restricted metadata by tenant and document id when create omits Id', async () => {
    provider.listItems
      .mockResolvedValueOnce([caseRow])
      .mockResolvedValueOnce([
        {
          Id: 25,
          TenantId: 'office-1',
          DocumentId: 'document-1',
        },
      ]);
    provider.createItem
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('events list unavailable'));
    provider.deleteItem.mockResolvedValue();

    await expect(
      repository.addRestrictedPersonalDocument({
        tenantId: 'office-1',
        supportCaseId: 'case-1',
        caseRecordId: null,
        fileName: 'certificate.pdf',
        storageLocator: 'restricted-drive-item-id',
        templateKey: null,
        templateVersion: null,
        createdBy: 'privacy-officer-1',
      }),
    ).rejects.toMatchObject({
      operation: 'addRestrictedPersonalDocument',
    });

    expect(provider.listItems).toHaveBeenNthCalledWith(
      2,
      SUPPORT_CASE_DOCUMENTS_LIST_TITLE,
      expect.objectContaining({
        filter: expect.stringContaining("TenantId eq 'office-1'"),
        top: 1,
      }),
    );
    expect(provider.deleteItem).toHaveBeenCalledWith(
      SUPPORT_CASE_DOCUMENTS_LIST_TITLE,
      25,
    );
  });

  it('does not write a document when the tenant-scoped case does not exist', async () => {
    provider.listItems.mockResolvedValue([]);

    await expect(
      repository.addDocumentReference({
        tenantId: 'office-2',
        supportCaseId: 'case-1',
        caseRecordId: null,
        category: 'assessment',
        fileName: 'assessment.pdf',
        storageClass: 'standard_library',
        storageLocator: 'standard-drive-item-id',
        sensitivity: 'confidential',
        auditLoggingRequired: true,
        templateKey: null,
        templateVersion: null,
        createdBy: 'staff-1',
      }),
    ).rejects.toBeInstanceOf(SupportCaseRepositoryError);

    expect(provider.createItem).not.toHaveBeenCalled();
  });

  it('fails safely when SharePoint read operations reject', async () => {
    provider.listItems.mockRejectedValue(new Error('SharePoint unavailable'));

    await expect(repository.listCases('office-1')).rejects.toMatchObject({
      name: 'SupportCaseRepositoryError',
      operation: 'listCases',
    });
  });

  it('never provisions SharePoint lists from the repository adapter', async () => {
    provider.listItems.mockResolvedValue([]);

    await repository.listCases('office-1');

    expect(provider.ensureListExists).not.toHaveBeenCalled();
  });
});
