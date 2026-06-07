import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { buildEq, joinAnd } from '@/sharepoint/query/builders';
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
import {
  toRestrictedDocumentListItem,
  toStandardDocumentListItem,
  toSupportCaseEventListItem,
  toSupportCaseListItem,
} from './sharePointMapper';
import {
  SUPPORT_CASE_DOCUMENTS_LIST_TITLE,
  SUPPORT_CASE_EVENTS_LIST_TITLE,
  SUPPORT_CASES_LIST_TITLE,
  supportCaseDocumentListItemSchema,
  supportCaseListItemSchema,
  type SupportCaseAuditEvent,
} from './sharePointProjection';

type EntityKind = 'case' | 'document' | 'event';

export interface SharePointSupportCaseRepositoryOptions {
  provider: IDataProvider;
  now?: () => string;
  createId?: (entity: EntityKind) => string;
  listTitles?: {
    cases?: string;
    documents?: string;
    events?: string;
  };
}

export class SupportCaseRepositoryError extends Error {
  readonly operation: string;
  readonly causeValue: unknown;

  constructor(operation: string, causeValue: unknown) {
    const message = causeValue instanceof Error ? causeValue.message : String(causeValue);
    super(`SupportCase repository ${operation} failed: ${message}`);
    this.name = 'SupportCaseRepositoryError';
    this.operation = operation;
    this.causeValue = causeValue;
  }
}

const defaultCreateId = (entity: EntityKind): string =>
  `${entity}-${globalThis.crypto.randomUUID()}`;

const CASE_SELECT = Object.keys(supportCaseListItemSchema.shape);
const DOCUMENT_SELECT = Object.keys(supportCaseDocumentListItemSchema.shape);

export class SharePointSupportCaseRepository implements SupportCaseRepository {
  private readonly provider: IDataProvider;
  private readonly now: () => string;
  private readonly createId: (entity: EntityKind) => string;
  private readonly casesListTitle: string;
  private readonly documentsListTitle: string;
  private readonly eventsListTitle: string;

  constructor(options: SharePointSupportCaseRepositoryOptions) {
    this.provider = options.provider;
    this.now = options.now ?? (() => new Date().toISOString());
    this.createId = options.createId ?? defaultCreateId;
    this.casesListTitle = options.listTitles?.cases ?? SUPPORT_CASES_LIST_TITLE;
    this.documentsListTitle =
      options.listTitles?.documents ?? SUPPORT_CASE_DOCUMENTS_LIST_TITLE;
    this.eventsListTitle = options.listTitles?.events ?? SUPPORT_CASE_EVENTS_LIST_TITLE;
  }

  async listCases(tenantId: string): Promise<SupportCaseSummary[]> {
    try {
      const rows = await this.provider.listItems<Record<string, unknown>>(
        this.casesListTitle,
        {
          select: CASE_SELECT,
          filter: buildEq('TenantId', tenantId),
          orderby: 'OpenedOn desc',
        },
      );
      return rows
        .map((row) => this.mapCaseRow(row))
        .filter((supportCase) => supportCase.tenantId === tenantId)
        .map(toSupportCaseSummary);
    } catch (error) {
      throw new SupportCaseRepositoryError('listCases', error);
    }
  }

  async getCase(
    tenantId: string,
    caseId: SupportCaseId,
  ): Promise<SupportCase | null> {
    try {
      const rows = await this.provider.listItems<Record<string, unknown>>(
        this.casesListTitle,
        {
          select: CASE_SELECT,
          filter: this.caseFilter(tenantId, caseId),
          top: 1,
        },
      );
      const supportCase = rows[0] ? this.mapCaseRow(rows[0]) : null;
      return supportCase?.tenantId === tenantId && supportCase.id === caseId
        ? supportCase
        : null;
    } catch (error) {
      throw new SupportCaseRepositoryError('getCase', error);
    }
  }

  async createCase(input: CreateSupportCaseInput): Promise<SupportCase> {
    const timestamp = this.now();
    const supportCase = supportCaseSchema.parse({
      ...input,
      id: this.createId('case'),
      createdAt: timestamp,
      updatedAt: timestamp,
      updatedBy: input.createdBy,
    });

    try {
      await this.provider.createItem(
        this.casesListTitle,
        toSupportCaseListItem(supportCase),
      );
      return supportCase;
    } catch (error) {
      throw new SupportCaseRepositoryError('createCase', error);
    }
  }

  async updateCase(
    tenantId: string,
    caseId: SupportCaseId,
    patch: UpdateSupportCaseInput,
  ): Promise<SupportCase> {
    try {
      const row = await this.findCaseRow(tenantId, caseId);
      if (!row) throw new Error(`Support case not found: ${caseId}`);

      const current = this.mapCaseRow(row);
      const updated = supportCaseSchema.parse({
        ...current,
        ...patch,
        id: caseId,
        tenantId,
        updatedAt: this.now(),
      });

      await this.provider.updateItem(
        this.casesListTitle,
        this.requireSharePointId(row, 'support case'),
        toSupportCaseListItem(updated),
        { etag: '*' },
      );
      return updated;
    } catch (error) {
      throw new SupportCaseRepositoryError('updateCase', error);
    }
  }

  async listDocumentReferences(
    tenantId: string,
    caseId: SupportCaseId,
  ): Promise<CaseDocument[]> {
    try {
      await this.requireCase(tenantId, caseId);
      const rows = await this.provider.listItems<Record<string, unknown>>(
        this.documentsListTitle,
        {
          select: DOCUMENT_SELECT,
          filter: joinAnd([
            buildEq('TenantId', tenantId),
            buildEq('SupportCaseId', caseId),
          ]),
          orderby: 'CreatedAt desc',
        },
      );
      return rows
        .map((row) => this.mapDocumentRow(row))
        .filter(
          (document) =>
            document.tenantId === tenantId &&
            document.supportCaseId === caseId,
        );
    } catch (error) {
      throw new SupportCaseRepositoryError('listDocumentReferences', error);
    }
  }

  async addDocumentReference(
    input: AddDocumentReferenceInput,
  ): Promise<CaseDocument> {
    try {
      const supportCaseId = this.requireInputCaseId(input.supportCaseId);
      await this.requireCase(input.tenantId, supportCaseId);
      const document = caseDocumentSchema.parse({
        ...input,
        id: this.createId('document'),
        createdAt: this.now(),
      });

      await this.provider.createItem(
        this.documentsListTitle,
        toStandardDocumentListItem(document),
      );
      return document;
    } catch (error) {
      throw new SupportCaseRepositoryError('addDocumentReference', error);
    }
  }

  async addRestrictedPersonalDocument(
    input: AddRestrictedPersonalDocumentInput,
  ): Promise<CaseDocument> {
    let createdItemId: string | number | null = null;
    let createdDocument: CaseDocument | null = null;

    try {
      const supportCaseId = this.requireInputCaseId(input.supportCaseId);
      await this.requireCase(input.tenantId, supportCaseId);
      const timestamp = this.now();
      const document = caseDocumentSchema.parse({
        ...input,
        id: this.createId('document'),
        category: 'personal_information',
        storageClass: 'restricted_library',
        sensitivity: 'restricted',
        auditLoggingRequired: true,
        createdAt: timestamp,
      });
      createdDocument = document;

      const created = await this.provider.createItem<Record<string, unknown>>(
        this.documentsListTitle,
        toRestrictedDocumentListItem(document),
      );
      createdItemId = this.optionalSharePointId(created);

      const event: SupportCaseAuditEvent = {
        id: this.createId('event'),
        tenantId: document.tenantId,
        supportCaseId,
        targetType: 'case_document',
        targetId: document.id,
        action: 'created',
        actorId: document.createdBy,
        occurredAt: timestamp,
        auditLogRequired: true,
        detailJson: JSON.stringify({
          category: document.category,
          storagePolicy: document.storageClass,
        }),
      };

      await this.provider.createItem(
        this.eventsListTitle,
        toSupportCaseEventListItem(event),
      );
      return document;
    } catch (error) {
      if (createdItemId === null && createdDocument !== null) {
        try {
          createdItemId = await this.findDocumentItemId(
            createdDocument.tenantId,
            createdDocument.id,
          );
        } catch (lookupError) {
          throw new SupportCaseRepositoryError(
            'addRestrictedPersonalDocument.rollbackLookup',
            this.combineErrors(error, lookupError, 'Rollback lookup failed'),
          );
        }
      }

      if (createdItemId !== null) {
        try {
          await this.provider.deleteItem(this.documentsListTitle, createdItemId);
        } catch (rollbackError) {
          throw new SupportCaseRepositoryError(
            'addRestrictedPersonalDocument.rollback',
            this.combineErrors(error, rollbackError, 'Rollback failed'),
          );
        }
      }
      throw new SupportCaseRepositoryError(
        'addRestrictedPersonalDocument',
        error,
      );
    }
  }

  private async findCaseRow(
    tenantId: string,
    caseId: SupportCaseId,
  ): Promise<Record<string, unknown> | null> {
    const rows = await this.provider.listItems<Record<string, unknown>>(
      this.casesListTitle,
      {
        select: ['Id', ...CASE_SELECT],
        filter: this.caseFilter(tenantId, caseId),
        top: 1,
      },
    );
    return (
      rows.find((row) => {
        const parsed = supportCaseListItemSchema.safeParse(row);
        return (
          parsed.success &&
          parsed.data.TenantId === tenantId &&
          parsed.data.CaseId === caseId
        );
      }) ?? null
    );
  }

  private async findDocumentItemId(
    tenantId: string,
    documentId: string,
  ): Promise<string | number | null> {
    const rows = await this.provider.listItems<Record<string, unknown>>(
      this.documentsListTitle,
      {
        select: ['Id', 'TenantId', 'DocumentId'],
        filter: joinAnd([
          buildEq('TenantId', tenantId),
          buildEq('DocumentId', documentId),
        ]),
        top: 1,
      },
    );
    const row = rows.find(
      (item) =>
        item.TenantId === tenantId &&
        item.DocumentId === documentId,
    );
    return row ? this.optionalSharePointId(row) : null;
  }

  private async requireCase(
    tenantId: string,
    caseId: SupportCaseId,
  ): Promise<SupportCase> {
    const row = await this.findCaseRow(tenantId, caseId);
    if (!row) throw new Error(`Support case not found: ${caseId}`);
    return this.mapCaseRow(row);
  }

  private caseFilter(tenantId: string, caseId: SupportCaseId): string {
    return joinAnd([
      buildEq('TenantId', tenantId),
      buildEq('CaseId', caseId),
    ]);
  }

  private mapCaseRow(row: Record<string, unknown>): SupportCase {
    const item = supportCaseListItemSchema.parse(row);
    return supportCaseSchema.parse({
      id: item.CaseId,
      tenantId: item.TenantId,
      userId: item.UserId,
      serviceType: item.ServiceType,
      status: item.Status,
      openedOn: item.OpenedOn,
      closedOn: item.ClosedOn,
      primaryStaffId: item.PrimaryStaffId,
      createdAt: item.CreatedAt,
      createdBy: item.CreatedByKey,
      updatedAt: item.UpdatedAt,
      updatedBy: item.UpdatedByKey,
    });
  }

  private mapDocumentRow(row: Record<string, unknown>): CaseDocument {
    const item = supportCaseDocumentListItemSchema.parse(row);
    return caseDocumentSchema.parse({
      id: item.DocumentId,
      tenantId: item.TenantId,
      supportCaseId: item.SupportCaseId,
      caseRecordId: item.CaseRecordId,
      category: item.Category,
      fileName: item.FileName,
      storageClass: item.StoragePolicy,
      storageLocator: item.StorageLocator,
      sensitivity: item.Sensitivity,
      auditLoggingRequired: item.AuditLogRequired,
      templateKey: item.TemplateKey,
      templateVersion: item.TemplateVersion,
      createdAt: item.CreatedAt,
      createdBy: item.CreatedByKey,
    });
  }

  private requireInputCaseId(caseId: string | null): string {
    if (!caseId) throw new Error('Support case id is required');
    return caseId;
  }

  private requireSharePointId(
    row: Record<string, unknown>,
    entity: string,
  ): string | number {
    const id = this.optionalSharePointId(row);
    if (id === null) throw new Error(`SharePoint ${entity} item id is missing`);
    return id;
  }

  private optionalSharePointId(row: Record<string, unknown>): string | number | null {
    const id = row.Id ?? row.ID ?? row.id;
    return typeof id === 'string' || typeof id === 'number' ? id : null;
  }

  private combineErrors(
    original: unknown,
    secondary: unknown,
    label: string,
  ): Error {
    const originalMessage =
      original instanceof Error ? original.message : String(original);
    const secondaryMessage =
      secondary instanceof Error ? secondary.message : String(secondary);
    return new Error(
      `Original failure: ${originalMessage}; ${label}: ${secondaryMessage}`,
    );
  }
}
