import type { RecordQualityReviewDraft } from './recordQualityReview';
import {
  fromRecordQualityReviewPersistenceItem,
  toRecordQualityReviewPersistenceItem,
  type RecordQualityReviewPersistenceItem,
} from './recordQualityReviewPersistenceMapper';
import type {
  RecordQualityReviewRecordId,
  RecordQualityReviewRepository,
} from './recordQualityReviewRepository';

export interface RecordQualityReviewPersistenceStore {
  list(): Promise<readonly RecordQualityReviewPersistenceItem[]>;
  get(recordId: RecordQualityReviewRecordId): Promise<RecordQualityReviewPersistenceItem | null>;
  create(
    item: RecordQualityReviewPersistenceItem,
  ): Promise<RecordQualityReviewPersistenceItem>;
  update(
    item: RecordQualityReviewPersistenceItem,
  ): Promise<RecordQualityReviewPersistenceItem>;
}

export class RecordQualityReviewPersistenceRepository
  implements RecordQualityReviewRepository
{
  constructor(private readonly store: RecordQualityReviewPersistenceStore) {}

  async saveReview(review: RecordQualityReviewDraft): Promise<RecordQualityReviewDraft> {
    const item = toRecordQualityReviewPersistenceItem(review);
    const existing = await this.store.get(item.recordId);
    if (existing) {
      throw new Error(`Record quality review already exists: ${item.recordId}`);
    }

    return fromRecordQualityReviewPersistenceItem(await this.store.create(item));
  }

  async getReview(
    recordId: RecordQualityReviewRecordId,
  ): Promise<RecordQualityReviewDraft | null> {
    const item = await this.store.get(recordId);
    return item ? fromRecordQualityReviewPersistenceItem(item) : null;
  }

  async updateReview(review: RecordQualityReviewDraft): Promise<RecordQualityReviewDraft> {
    const item = toRecordQualityReviewPersistenceItem(review);
    const existing = await this.store.get(item.recordId);
    if (!existing) {
      throw new Error(`Record quality review not found: ${item.recordId}`);
    }

    return fromRecordQualityReviewPersistenceItem(await this.store.update(item));
  }

  async listReviews(): Promise<RecordQualityReviewDraft[]> {
    const items = await this.store.list();
    return items.map(fromRecordQualityReviewPersistenceItem);
  }
}

export class InMemoryRecordQualityReviewPersistenceStore
  implements RecordQualityReviewPersistenceStore
{
  private readonly items = new Map<
    RecordQualityReviewRecordId,
    RecordQualityReviewPersistenceItem
  >();

  constructor(seed: readonly RecordQualityReviewPersistenceItem[] = []) {
    for (const item of seed) {
      if (this.items.has(item.recordId)) {
        throw new Error(`Record quality review persistence item already exists: ${item.recordId}`);
      }
      this.items.set(item.recordId, clone(item));
    }
  }

  async list(): Promise<readonly RecordQualityReviewPersistenceItem[]> {
    return [...this.items.values()].map(clone);
  }

  async get(
    recordId: RecordQualityReviewRecordId,
  ): Promise<RecordQualityReviewPersistenceItem | null> {
    const item = this.items.get(recordId);
    return item ? clone(item) : null;
  }

  async create(
    item: RecordQualityReviewPersistenceItem,
  ): Promise<RecordQualityReviewPersistenceItem> {
    if (this.items.has(item.recordId)) {
      throw new Error(`Record quality review persistence item already exists: ${item.recordId}`);
    }

    this.items.set(item.recordId, clone(item));
    return clone(item);
  }

  async update(
    item: RecordQualityReviewPersistenceItem,
  ): Promise<RecordQualityReviewPersistenceItem> {
    if (!this.items.has(item.recordId)) {
      throw new Error(`Record quality review persistence item not found: ${item.recordId}`);
    }

    this.items.set(item.recordId, clone(item));
    return clone(item);
  }
}

function clone<T>(value: T): T {
  return structuredClone(value);
}
