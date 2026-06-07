import { describe, expect, it } from 'vitest';
import { InMemorySupportCaseRepository } from '../InMemorySupportCaseRepository';
import type {
  AddDocumentReferenceInput,
  SupportCaseRepository,
} from '../repository';

const timestamp = '2026-06-07T12:00:00+09:00';

const createRepository = (): SupportCaseRepository => {
  let nextId = 1;
  return new InMemorySupportCaseRepository(
    {},
    {
      now: () => timestamp,
      createId: (entity) => `${entity}-${nextId++}`,
    },
  );
};

const createCase = (repository: SupportCaseRepository, tenantId = 'office-1') =>
  repository.createCase({
    tenantId,
    userId: 'U001',
    serviceType: 'daily_life_care',
    status: 'active',
    openedOn: '2026-04-01',
    closedOn: null,
    primaryStaffId: 'staff-1',
    createdBy: 'staff-1',
  });

const runSupportCaseRepositoryContract = (
  name: string,
  factory: () => SupportCaseRepository,
): void => {
  describe(name, () => {
    it('creates, retrieves, lists, and updates cases within a tenant', async () => {
      const repository = factory();
      const created = await createCase(repository);

      expect(await repository.getCase('office-1', created.id)).toEqual(created);
      expect(await repository.getCase('office-2', created.id)).toBeNull();
      expect(await repository.listCases('office-1')).toEqual([
        expect.objectContaining({
          id: created.id,
          tenantId: 'office-1',
          userId: 'U001',
          status: 'active',
        }),
      ]);

      const updated = await repository.updateCase('office-1', created.id, {
        status: 'closed',
        closedOn: '2026-06-07',
        updatedBy: 'staff-2',
      });

      expect(updated.status).toBe('closed');
      expect(updated.closedOn).toBe('2026-06-07');
      expect(updated.updatedBy).toBe('staff-2');
    });

    it('does not expose mutable internal state', async () => {
      const repository = factory();
      const created = await createCase(repository);
      created.primaryStaffId = 'tampered';

      const stored = await repository.getCase('office-1', created.id);
      expect(stored?.primaryStaffId).toBe('staff-1');
    });

    it('stores standard document references through the standard path', async () => {
      const repository = factory();
      const supportCase = await createCase(repository);

      const document = await repository.addDocumentReference({
        tenantId: 'office-1',
        supportCaseId: supportCase.id,
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

      expect(document.category).toBe('assessment');
      expect(await repository.listDocumentReferences('office-1', supportCase.id))
        .toEqual([document]);
    });

    it('rejects personal information sent through the standard document path', async () => {
      const repository = factory();
      const supportCase = await createCase(repository);
      const invalidInput = {
        tenantId: 'office-1',
        supportCaseId: supportCase.id,
        caseRecordId: null,
        category: 'personal_information',
        fileName: 'certificate.pdf',
        storageClass: 'standard_library',
        storageLocator: 'standard-drive-item-id',
        sensitivity: 'confidential',
        auditLoggingRequired: false,
        templateKey: null,
        templateVersion: null,
        createdBy: 'staff-1',
      } as unknown as AddDocumentReferenceInput;

      await expect(repository.addDocumentReference(invalidInput)).rejects.toThrow(
        'addRestrictedPersonalDocument',
      );
      expect(await repository.listDocumentReferences('office-1', supportCase.id))
        .toEqual([]);
    });

    it('forces isolated storage and audit logging on restricted personal documents', async () => {
      const repository = factory();
      const supportCase = await createCase(repository);

      const document = await repository.addRestrictedPersonalDocument({
        tenantId: 'office-1',
        supportCaseId: supportCase.id,
        caseRecordId: null,
        fileName: 'certificate.pdf',
        storageLocator: 'restricted-drive-item-id',
        templateKey: null,
        templateVersion: null,
        createdBy: 'privacy-officer-1',
      });

      expect(document).toMatchObject({
        category: 'personal_information',
        storageClass: 'restricted_library',
        sensitivity: 'restricted',
        auditLoggingRequired: true,
      });
    });
  });
};

runSupportCaseRepositoryContract(
  'InMemorySupportCaseRepository contract',
  createRepository,
);
