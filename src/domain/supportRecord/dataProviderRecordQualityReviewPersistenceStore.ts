import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { buildEq } from '@/sharepoint/query/builders';
import type {
  RecordQualityReviewRecordId,
} from './recordQualityReviewRepository';
import type {
  RecordQualityReviewPersistenceItem,
} from './recordQualityReviewPersistenceMapper';
import type {
  RecordQualityReviewPersistenceStore,
} from './recordQualityReviewPersistenceRepository';

export const RECORD_QUALITY_REVIEW_LIST_TITLE = 'RecordQualityReview';

export const RECORD_QUALITY_REVIEW_FIELDS = {
  title: 'Title',
  recordId: 'RecordId',
  sourceRecordId: 'SourceRecordId',
  status: 'ReviewStatus',
  reviewerId: 'ReviewerId',
  reviewerName: 'ReviewerName',
  suggestedCategoriesJson: 'SuggestedCategoriesJson',
  missingInfoHintsJson: 'MissingInfoHintsJson',
  reviewerNotesJson: 'ReviewerNotesJson',
  createdAt: 'CreatedAt',
  updatedAt: 'UpdatedAt',
} as const;

type RecordQualityReviewRow = {
  readonly Id?: number;
  readonly id?: number | string;
  readonly Title?: string;
  readonly RecordId?: string;
  readonly SourceRecordId?: string;
  readonly ReviewStatus?: RecordQualityReviewPersistenceItem['status'];
  readonly ReviewerId?: string | null;
  readonly ReviewerName?: string | null;
  readonly SuggestedCategoriesJson?: string;
  readonly MissingInfoHintsJson?: string;
  readonly ReviewerNotesJson?: string;
  readonly CreatedAt?: string;
  readonly UpdatedAt?: string;
};

export type DataProviderRecordQualityReviewPersistenceStoreOptions = {
  readonly provider: IDataProvider;
  readonly listTitle?: string;
};

export class DataProviderRecordQualityReviewPersistenceStore
  implements RecordQualityReviewPersistenceStore
{
  private readonly provider: IDataProvider;
  private readonly listTitle: string;

  constructor(options: DataProviderRecordQualityReviewPersistenceStoreOptions) {
    this.provider = options.provider;
    this.listTitle = options.listTitle ?? RECORD_QUALITY_REVIEW_LIST_TITLE;
  }

  async list(): Promise<readonly RecordQualityReviewPersistenceItem[]> {
    const rows = await this.provider.listItems<RecordQualityReviewRow>(this.listTitle, {
      select: selectFields,
      orderby: `${RECORD_QUALITY_REVIEW_FIELDS.updatedAt} asc`,
    });

    return rows.map(fromRow);
  }

  async get(
    recordId: RecordQualityReviewRecordId,
  ): Promise<RecordQualityReviewPersistenceItem | null> {
    const rows = await this.provider.listItems<RecordQualityReviewRow>(this.listTitle, {
      select: selectFields,
      filter: buildEq(RECORD_QUALITY_REVIEW_FIELDS.recordId, recordId),
      top: 1,
    });

    return rows[0] ? fromRow(rows[0]) : null;
  }

  async create(
    item: RecordQualityReviewPersistenceItem,
  ): Promise<RecordQualityReviewPersistenceItem> {
    await this.provider.createItem(this.listTitle, toRow(item));
    return item;
  }

  async update(
    item: RecordQualityReviewPersistenceItem,
  ): Promise<RecordQualityReviewPersistenceItem> {
    const row = await this.findRow(item.recordId);
    if (!row) {
      throw new Error(`Record quality review persistence item not found: ${item.recordId}`);
    }

    await this.provider.updateItem(
      this.listTitle,
      readSharePointId(row),
      toRow(item),
      { etag: '*' },
    );
    return item;
  }

  private async findRow(
    recordId: RecordQualityReviewRecordId,
  ): Promise<RecordQualityReviewRow | null> {
    const rows = await this.provider.listItems<RecordQualityReviewRow>(this.listTitle, {
      select: ['Id', ...selectFields],
      filter: buildEq(RECORD_QUALITY_REVIEW_FIELDS.recordId, recordId),
      top: 1,
    });

    return rows[0] ?? null;
  }
}

const selectFields = [
  RECORD_QUALITY_REVIEW_FIELDS.recordId,
  RECORD_QUALITY_REVIEW_FIELDS.sourceRecordId,
  RECORD_QUALITY_REVIEW_FIELDS.status,
  RECORD_QUALITY_REVIEW_FIELDS.reviewerId,
  RECORD_QUALITY_REVIEW_FIELDS.reviewerName,
  RECORD_QUALITY_REVIEW_FIELDS.suggestedCategoriesJson,
  RECORD_QUALITY_REVIEW_FIELDS.missingInfoHintsJson,
  RECORD_QUALITY_REVIEW_FIELDS.reviewerNotesJson,
  RECORD_QUALITY_REVIEW_FIELDS.createdAt,
  RECORD_QUALITY_REVIEW_FIELDS.updatedAt,
];

function toRow(
  item: RecordQualityReviewPersistenceItem,
): Record<string, unknown> {
  return {
    [RECORD_QUALITY_REVIEW_FIELDS.title]: item.recordId,
    [RECORD_QUALITY_REVIEW_FIELDS.recordId]: item.recordId,
    [RECORD_QUALITY_REVIEW_FIELDS.sourceRecordId]: item.sourceRecordId,
    [RECORD_QUALITY_REVIEW_FIELDS.status]: item.status,
    [RECORD_QUALITY_REVIEW_FIELDS.reviewerId]: item.reviewerId ?? null,
    [RECORD_QUALITY_REVIEW_FIELDS.reviewerName]: item.reviewerName ?? null,
    [RECORD_QUALITY_REVIEW_FIELDS.suggestedCategoriesJson]: item.suggestedCategoriesJson,
    [RECORD_QUALITY_REVIEW_FIELDS.missingInfoHintsJson]: item.missingInfoHintsJson,
    [RECORD_QUALITY_REVIEW_FIELDS.reviewerNotesJson]: item.reviewerNotesJson,
    [RECORD_QUALITY_REVIEW_FIELDS.createdAt]: item.createdAt,
    [RECORD_QUALITY_REVIEW_FIELDS.updatedAt]: item.updatedAt,
  };
}

function fromRow(row: RecordQualityReviewRow): RecordQualityReviewPersistenceItem {
  return {
    recordId: requireString(row.RecordId, RECORD_QUALITY_REVIEW_FIELDS.recordId),
    sourceRecordId: requireString(
      row.SourceRecordId,
      RECORD_QUALITY_REVIEW_FIELDS.sourceRecordId,
    ),
    status: requireString(
      row.ReviewStatus,
      RECORD_QUALITY_REVIEW_FIELDS.status,
    ) as RecordQualityReviewPersistenceItem['status'],
    reviewerId: readOptionalString(row.ReviewerId),
    reviewerName: readOptionalString(row.ReviewerName),
    suggestedCategoriesJson: requireString(
      row.SuggestedCategoriesJson,
      RECORD_QUALITY_REVIEW_FIELDS.suggestedCategoriesJson,
    ),
    missingInfoHintsJson: requireString(
      row.MissingInfoHintsJson,
      RECORD_QUALITY_REVIEW_FIELDS.missingInfoHintsJson,
    ),
    reviewerNotesJson: requireString(
      row.ReviewerNotesJson,
      RECORD_QUALITY_REVIEW_FIELDS.reviewerNotesJson,
    ),
    createdAt: requireString(row.CreatedAt, RECORD_QUALITY_REVIEW_FIELDS.createdAt),
    updatedAt: requireString(row.UpdatedAt, RECORD_QUALITY_REVIEW_FIELDS.updatedAt),
  };
}

function readSharePointId(row: RecordQualityReviewRow): string | number {
  const id = row.Id ?? row.id;
  if (typeof id !== 'string' && typeof id !== 'number') {
    throw new Error('Record quality review persistence row is missing SharePoint id');
  }

  return id;
}

function requireString(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new Error(`Record quality review persistence row field is missing: ${fieldName}`);
  }

  return value;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value ? value : undefined;
}
