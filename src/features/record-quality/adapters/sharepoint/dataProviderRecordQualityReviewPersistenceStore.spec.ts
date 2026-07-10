import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import {
  DataProviderRecordQualityReviewPersistenceStore,
  RECORD_QUALITY_REVIEW_FIELDS,
} from './dataProviderRecordQualityReviewPersistenceStore';
import type {
  RecordQualityReviewPersistenceItem,
} from './recordQualityReviewPersistenceMapper';

const listTitle = 'RecordQualityReview_Test';

const item: RecordQualityReviewPersistenceItem = {
  recordId: 'review-1',
  sourceRecordId: 'support-record-1',
  status: 'draft',
  reviewerId: 'reviewer-1',
  reviewerName: '山田 太郎',
  suggestedCategoriesJson: JSON.stringify([
    {
      categoryId: 'meal',
      matchedSignals: ['食事'],
      source: 'rule',
    },
  ]),
  missingInfoHintsJson: JSON.stringify([
    {
      code: 'time',
      label: '時刻',
      source: 'rule',
    },
  ]),
  reviewerNotesJson: JSON.stringify(['確認待ち']),
  createdAt: '2026-06-12T09:00:00+09:00',
  updatedAt: '2026-06-12T09:00:00+09:00',
};

type MockProvider = Mocked<IDataProvider>;

const makeProvider = (): MockProvider => ({
  listItems: vi.fn(async <T>() => [] as T[]) as MockProvider['listItems'],
  getItemById: vi.fn(async <T>() => ({} as T)) as MockProvider['getItemById'],
  createItem: vi.fn(async <T>() => ({} as T)) as MockProvider['createItem'],
  updateItem: vi.fn(async <T>() => ({} as T)) as MockProvider['updateItem'],
  deleteItem: vi.fn(async () => undefined) as MockProvider['deleteItem'],
  getMetadata: vi.fn(async () => ({})) as MockProvider['getMetadata'],
  getResourceNames: vi.fn(async () => []) as MockProvider['getResourceNames'],
  getFieldInternalNames: vi.fn(async () => new Set<string>()) as MockProvider['getFieldInternalNames'],
  ensureListExists: vi.fn(async () => undefined) as MockProvider['ensureListExists'],
  seed: vi.fn(async () => undefined) as NonNullable<MockProvider['seed']>,
});

describe('DataProviderRecordQualityReviewPersistenceStore', () => {
  let provider: Mocked<IDataProvider>;
  let store: DataProviderRecordQualityReviewPersistenceStore;

  beforeEach(() => {
    provider = makeProvider();
    store = new DataProviderRecordQualityReviewPersistenceStore({
      provider,
      listTitle,
    });
  });

  it('lists persistence items from the configured data provider list', async () => {
    provider.listItems.mockResolvedValue([toRow(item, 10)]);

    const result = await store.list();

    expect(provider.listItems).toHaveBeenCalledWith(
      listTitle,
      expect.objectContaining({
        select: expect.arrayContaining([
          RECORD_QUALITY_REVIEW_FIELDS.recordId,
          RECORD_QUALITY_REVIEW_FIELDS.sourceRecordId,
          RECORD_QUALITY_REVIEW_FIELDS.status,
          RECORD_QUALITY_REVIEW_FIELDS.updatedAt,
        ]),
        orderby: `${RECORD_QUALITY_REVIEW_FIELDS.updatedAt} asc`,
      }),
    );
    expect(result).toEqual([item]);
  });

  it('gets one item by record id without loading original record text', async () => {
    provider.listItems.mockResolvedValue([
      {
        ...toRow(item, 10),
        Body: '利用者の元支援記録本文',
      },
    ]);

    const result = await store.get(item.recordId);

    expect(provider.listItems).toHaveBeenCalledWith(
      listTitle,
      expect.objectContaining({
        filter: `${RECORD_QUALITY_REVIEW_FIELDS.recordId} eq '${item.recordId}'`,
        top: 1,
      }),
    );
    expect(JSON.stringify(result)).not.toContain('元支援記録本文');
    expect(result).toEqual(item);
  });

  it('creates a row payload from persistence metadata only', async () => {
    provider.createItem.mockResolvedValue({ Id: 11 });

    await store.create(item);

    expect(provider.createItem).toHaveBeenCalledWith(
      listTitle,
      expect.objectContaining({
        Title: item.recordId,
        RecordId: item.recordId,
        SourceRecordId: item.sourceRecordId,
        ReviewStatus: item.status,
        SuggestedCategoriesJson: item.suggestedCategoriesJson,
        MissingInfoHintsJson: item.missingInfoHintsJson,
        ReviewerNotesJson: item.reviewerNotesJson,
      }),
    );

    const [, payload] = provider.createItem.mock.calls[0];
    expect(payload).not.toHaveProperty('Body');
    expect(payload).not.toHaveProperty('OriginalRecordText');
  });

  it('updates an existing row by SharePoint id', async () => {
    provider.listItems.mockResolvedValue([toRow(item, 42)]);
    provider.updateItem.mockResolvedValue({});

    const updatedItem: RecordQualityReviewPersistenceItem = {
      ...item,
      status: 'accepted',
      reviewerNotesJson: JSON.stringify(['承認済み']),
      updatedAt: '2026-06-12T10:00:00+09:00',
    };

    await store.update(updatedItem);

    expect(provider.listItems).toHaveBeenCalledWith(
      listTitle,
      expect.objectContaining({
        select: expect.arrayContaining([
          'Id',
          RECORD_QUALITY_REVIEW_FIELDS.recordId,
        ]),
        filter: `${RECORD_QUALITY_REVIEW_FIELDS.recordId} eq '${item.recordId}'`,
        top: 1,
      }),
    );
    expect(provider.updateItem).toHaveBeenCalledWith(
      listTitle,
      42,
      expect.objectContaining({
        RecordId: updatedItem.recordId,
        ReviewStatus: 'accepted',
        ReviewerNotesJson: updatedItem.reviewerNotesJson,
        UpdatedAt: updatedItem.updatedAt,
      }),
      { etag: '*' },
    );
  });

  it('rejects update when the backing row is missing', async () => {
    provider.listItems.mockResolvedValue([]);

    await expect(store.update(item)).rejects.toThrow(
      `Record quality review persistence item not found: ${item.recordId}`,
    );
    expect(provider.updateItem).not.toHaveBeenCalled();
  });

  it('rejects malformed rows before returning partial persistence metadata', async () => {
    provider.listItems.mockResolvedValue([
      {
        Id: 1,
        RecordId: item.recordId,
      },
    ]);

    await expect(store.list()).rejects.toThrow(
      'Record quality review persistence row field is missing',
    );
  });
});

function toRow(
  source: RecordQualityReviewPersistenceItem,
  id: number,
): Record<string, unknown> {
  return {
    Id: id,
    Title: source.recordId,
    RecordId: source.recordId,
    SourceRecordId: source.sourceRecordId,
    ReviewStatus: source.status,
    ReviewerId: source.reviewerId,
    ReviewerName: source.reviewerName,
    SuggestedCategoriesJson: source.suggestedCategoriesJson,
    MissingInfoHintsJson: source.missingInfoHintsJson,
    ReviewerNotesJson: source.reviewerNotesJson,
    CreatedAt: source.createdAt,
    UpdatedAt: source.updatedAt,
  };
}
