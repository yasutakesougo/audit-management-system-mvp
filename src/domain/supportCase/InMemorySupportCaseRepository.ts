import type {
  AddDocumentReferenceInput,
  AddRestrictedPersonalDocumentInput,
  CreateSupportCaseInput,
  SupportCaseId,
  SupportCaseRepository,
  SupportCaseSummary,
  UpdateSupportCaseInput,
} from './repository';
import { toSupportCaseSummary } from './repository';
import {
  caseDocumentSchema,
  supportCaseSchema,
  type CaseDocument,
  type SupportCase,
} from './schema';

export interface InMemorySupportCaseRepositoryOptions {
  now?: () => string;
  createId?: (entity: 'case' | 'document') => string;
}

export interface InMemorySupportCaseRepositorySeed {
  cases?: readonly SupportCase[];
  documents?: readonly CaseDocument[];
}

const clone = <T>(value: T): T => structuredClone(value);

const defaultCreateId = (entity: 'case' | 'document'): string =>
  `${entity}-${globalThis.crypto.randomUUID()}`;

export class InMemorySupportCaseRepository implements SupportCaseRepository {
  private cases: SupportCase[];
  private documents: CaseDocument[];
  private readonly now: () => string;
  private readonly createId: (entity: 'case' | 'document') => string;

  constructor(
    seed: InMemorySupportCaseRepositorySeed = {},
    options: InMemorySupportCaseRepositoryOptions = {},
  ) {
    this.cases = (seed.cases ?? []).map((item) => supportCaseSchema.parse(clone(item)));
    this.documents = (seed.documents ?? []).map((item) => caseDocumentSchema.parse(clone(item)));
    this.now = options.now ?? (() => new Date().toISOString());
    this.createId = options.createId ?? defaultCreateId;
  }

  async listCases(tenantId: string): Promise<SupportCaseSummary[]> {
    return this.cases
      .filter((item) => item.tenantId === tenantId)
      .map(toSupportCaseSummary)
      .map(clone);
  }

  async getCase(tenantId: string, caseId: SupportCaseId): Promise<SupportCase | null> {
    const supportCase = this.findCase(tenantId, caseId);
    return supportCase ? clone(supportCase) : null;
  }

  async createCase(input: CreateSupportCaseInput): Promise<SupportCase> {
    const timestamp = this.now();
    const created = supportCaseSchema.parse({
      ...clone(input),
      id: this.createId('case'),
      createdAt: timestamp,
      updatedAt: timestamp,
      updatedBy: input.createdBy,
    });

    if (this.cases.some((item) => item.id === created.id)) {
      throw new Error(`Support case id already exists: ${created.id}`);
    }

    this.cases.push(created);
    return clone(created);
  }

  async updateCase(
    tenantId: string,
    caseId: SupportCaseId,
    patch: UpdateSupportCaseInput,
  ): Promise<SupportCase> {
    const index = this.cases.findIndex(
      (item) => item.tenantId === tenantId && item.id === caseId,
    );
    if (index < 0) {
      throw new Error(`Support case not found: ${caseId}`);
    }

    const updated = supportCaseSchema.parse({
      ...this.cases[index],
      ...clone(patch),
      id: caseId,
      tenantId,
      updatedAt: this.now(),
    });
    this.cases[index] = updated;
    return clone(updated);
  }

  async listDocumentReferences(
    tenantId: string,
    caseId: SupportCaseId,
  ): Promise<CaseDocument[]> {
    this.requireCase(tenantId, caseId);
    return this.documents
      .filter((item) => item.tenantId === tenantId && item.supportCaseId === caseId)
      .map(clone);
  }

  async addDocumentReference(input: AddDocumentReferenceInput): Promise<CaseDocument> {
    if ((input.category as string) === 'personal_information') {
      throw new Error(
        'Personal information documents must use addRestrictedPersonalDocument',
      );
    }
    if (input.supportCaseId === null) {
      throw new Error('Standard case documents require a support case id');
    }

    this.requireCase(input.tenantId, input.supportCaseId);
    return this.storeDocument({
      ...clone(input),
      id: this.createId('document'),
      createdAt: this.now(),
    });
  }

  async addRestrictedPersonalDocument(
    input: AddRestrictedPersonalDocumentInput,
  ): Promise<CaseDocument> {
    if (input.supportCaseId === null) {
      throw new Error('Restricted personal documents require a support case id');
    }

    this.requireCase(input.tenantId, input.supportCaseId);
    return this.storeDocument({
      ...clone(input),
      id: this.createId('document'),
      category: 'personal_information',
      storageClass: 'restricted_library',
      sensitivity: 'restricted',
      auditLoggingRequired: true,
      createdAt: this.now(),
    });
  }

  private findCase(tenantId: string, caseId: SupportCaseId): SupportCase | undefined {
    return this.cases.find((item) => item.tenantId === tenantId && item.id === caseId);
  }

  private requireCase(tenantId: string, caseId: SupportCaseId): SupportCase {
    const supportCase = this.findCase(tenantId, caseId);
    if (!supportCase) {
      throw new Error(`Support case not found: ${caseId}`);
    }
    return supportCase;
  }

  private storeDocument(document: unknown): CaseDocument {
    const created = caseDocumentSchema.parse(document);
    if (this.documents.some((item) => item.id === created.id)) {
      throw new Error(`Case document id already exists: ${created.id}`);
    }
    this.documents.push(created);
    return clone(created);
  }
}
