import type {
  CaseDocument,
  CaseRecordCategory,
  SupportCase,
  SupportCaseStatus,
} from './schema';

export type SupportCaseId = string;

export type SupportCaseSummary = Pick<
  SupportCase,
  'id' | 'tenantId' | 'userId' | 'serviceType' | 'status' | 'openedOn' | 'closedOn' | 'primaryStaffId'
>;

export type CreateSupportCaseInput = Pick<
  SupportCase,
  'tenantId' | 'userId' | 'serviceType' | 'status' | 'openedOn' | 'closedOn' | 'primaryStaffId' | 'createdBy'
>;

export type UpdateSupportCaseInput = Partial<
  Pick<SupportCase, 'serviceType' | 'status' | 'openedOn' | 'closedOn' | 'primaryStaffId'>
> & {
  updatedBy: string;
};

type NonRestrictedDocumentCategory = Exclude<CaseRecordCategory, 'personal_information'>;

type DocumentReferenceInputBase = Pick<
  CaseDocument,
  | 'tenantId'
  | 'supportCaseId'
  | 'caseRecordId'
  | 'fileName'
  | 'storageLocator'
  | 'templateKey'
  | 'templateVersion'
  | 'createdBy'
>;

/** Input accepted by the standard document path. Personal information is excluded. */
export type AddDocumentReferenceInput = DocumentReferenceInputBase & {
  category: NonRestrictedDocumentCategory;
  storageClass: 'standard_library';
  sensitivity: 'standard' | 'confidential';
  auditLoggingRequired: boolean;
};

/**
 * Input accepted only by the restricted document path.
 * Security fields are assigned by the repository and cannot be weakened by callers.
 */
export type AddRestrictedPersonalDocumentInput = DocumentReferenceInputBase;

export interface SupportCaseRepository {
  listCases(tenantId: string): Promise<SupportCaseSummary[]>;
  getCase(tenantId: string, caseId: SupportCaseId): Promise<SupportCase | null>;
  createCase(input: CreateSupportCaseInput): Promise<SupportCase>;
  updateCase(
    tenantId: string,
    caseId: SupportCaseId,
    patch: UpdateSupportCaseInput,
  ): Promise<SupportCase>;

  listDocumentReferences(tenantId: string, caseId: SupportCaseId): Promise<CaseDocument[]>;
  addDocumentReference(input: AddDocumentReferenceInput): Promise<CaseDocument>;
  addRestrictedPersonalDocument(
    input: AddRestrictedPersonalDocumentInput,
  ): Promise<CaseDocument>;
}

export const toSupportCaseSummary = (supportCase: SupportCase): SupportCaseSummary => ({
  id: supportCase.id,
  tenantId: supportCase.tenantId,
  userId: supportCase.userId,
  serviceType: supportCase.serviceType,
  status: supportCase.status,
  openedOn: supportCase.openedOn,
  closedOn: supportCase.closedOn,
  primaryStaffId: supportCase.primaryStaffId,
});

export const isOpenSupportCaseStatus = (status: SupportCaseStatus): boolean =>
  status !== 'closed';
