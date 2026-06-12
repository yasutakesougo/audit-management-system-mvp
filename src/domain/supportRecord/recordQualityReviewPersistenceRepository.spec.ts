import { describe, expect, it } from 'vitest';

import {
  acceptRecordQualityReviewDraft,
  createRecordQualityReviewDraft,
  reviseRecordQualityReviewDraft,
  type RecordQualityReviewDraft,
} from './recordQualityReview';
import { buildRecordQualityHumanReviewQueue } from './recordQualityHumanReviewQueue';
import {
  InMemoryRecordQualityReviewPersistenceStore,
  RecordQualityReviewPersistenceRepository,
} from './recordQualityReviewPersistenceRepository';
import {
  toRecordQualityReviewPersistenceItem,
  type RecordQualityReviewPersistenceItem,
} from './recordQualityReviewPersistenceMapper';

function createReview(recordId = 'record-1'): RecordQualityReviewDraft {
  return createRecordQualityReviewDraft({
    recordId,
    suggestedCategories: [
      {
        categoryId: 'staffSupportActions',
        matchedSignals: ['職員', '声かけ'],
        source: 'rule',
      },
    ],
    missingInformationHints: [
      {
        code: 'userResponseAfterSupport',
        label: '支援後の本人の反応',
        source: 'rule',
      },
    ],
    notes: ['人間レビューで確認する'],
    createdAt: '2026-06-11T00:00:00.000Z',
  });
}

describe('RecordQualityReviewPersistenceRepository', () => {
  it('saves and retrieves review metadata through persistence items', async () => {
    const store = new InMemoryRecordQualityReviewPersistenceStore();
    const repository = new RecordQualityReviewPersistenceRepository(store);

    const saved = await repository.saveReview(createReview('record-1'));
    const storedItem = await store.get('record-1');
    const retrieved = await repository.getReview('record-1');

    expect(saved).toEqual(retrieved);
    expect(storedItem).toMatchObject({
      recordId: 'record-1',
      sourceRecordId: 'record-1',
      status: 'draft',
      createdAt: '2026-06-11T00:00:00.000Z',
      updatedAt: '2026-06-11T00:00:00.000Z',
    });
    expect(JSON.parse(storedItem?.suggestedCategoriesJson ?? '[]')).toEqual([
      {
        categoryId: 'staffSupportActions',
        matchedSignals: ['職員', '声かけ'],
        source: 'rule',
      },
    ]);
  });

  it('updates persisted review metadata and supports active queue reconstruction', async () => {
    const repository = new RecordQualityReviewPersistenceRepository(
      new InMemoryRecordQualityReviewPersistenceStore(),
    );
    const saved = await repository.saveReview(createReview('record-revised'));

    const revised = await repository.updateReview(
      reviseRecordQualityReviewDraft(saved, {
        notes: ['確認観点を修正する'],
        updatedAt: '2026-06-11T02:00:00.000Z',
      }),
    );
    const queue = buildRecordQualityHumanReviewQueue(await repository.listReviews());

    expect(revised).toMatchObject({
      recordId: 'record-revised',
      status: 'revised',
      notes: ['確認観点を修正する'],
      sourceOfTruth: 'original_record',
      outputKind: 'review_metadata',
      requiresHumanReview: true,
    });
    expect(queue.items.map(item => item.recordId)).toEqual(['record-revised']);
    expect(queue.items[0]).toMatchObject({
      status: 'revised',
      sourceRecordId: 'record-revised',
      sourceOfTruth: 'original_record',
      outputKind: 'review_metadata',
      requiresHumanReview: true,
    });
  });

  it('keeps terminal accepted reviews out of the active queue after persistence update', async () => {
    const repository = new RecordQualityReviewPersistenceRepository(
      new InMemoryRecordQualityReviewPersistenceStore(),
    );
    const saved = await repository.saveReview(createReview('record-accepted'));

    await repository.updateReview(
      acceptRecordQualityReviewDraft(saved, '2026-06-11T01:00:00.000Z'),
    );
    const queue = buildRecordQualityHumanReviewQueue(await repository.listReviews());

    expect(queue.items).toEqual([]);
    await expect(repository.getReview('record-accepted')).resolves.toMatchObject({
      status: 'accepted',
      updatedAt: '2026-06-11T01:00:00.000Z',
      originalRecord: { recordId: 'record-accepted' },
    });
  });

  it('preserves source record id separately from the persistence record id', async () => {
    const item: RecordQualityReviewPersistenceItem = {
      ...toRecordQualityReviewPersistenceItem(createReview('support-record-1')),
      recordId: 'review-row-1',
      sourceRecordId: 'support-record-1',
    };
    const repository = new RecordQualityReviewPersistenceRepository(
      new InMemoryRecordQualityReviewPersistenceStore([item]),
    );

    const review = await repository.getReview('review-row-1');

    expect(review).toMatchObject({
      recordId: 'review-row-1',
      originalRecord: { recordId: 'support-record-1' },
      sourceOfTruth: 'original_record',
      outputKind: 'review_metadata',
      requiresHumanReview: true,
    });
  });

  it('does not persist original support record text through the repository boundary', async () => {
    const store = new InMemoryRecordQualityReviewPersistenceStore();
    const repository = new RecordQualityReviewPersistenceRepository(store);
    const reviewWithText = {
      ...createReview('record-with-text'),
      body: '元の支援記録本文',
      content: '本人の反応などの本文',
      originalText: 'original text',
    } as RecordQualityReviewDraft & {
      body: string;
      content: string;
      originalText: string;
    };

    await repository.saveReview(reviewWithText);
    const persisted = await store.get('record-with-text');
    const serialized = JSON.stringify(persisted);

    expect(serialized).not.toContain('元の支援記録本文');
    expect(serialized).not.toContain('本人の反応などの本文');
    expect(serialized).not.toContain('original text');
    expect('body' in (persisted ?? {})).toBe(false);
    expect('content' in (persisted ?? {})).toBe(false);
    expect('originalText' in (persisted ?? {})).toBe(false);
  });

  it('rejects duplicate saves and updates to missing reviews before mutating the store', async () => {
    const store = new InMemoryRecordQualityReviewPersistenceStore();
    const repository = new RecordQualityReviewPersistenceRepository(store);
    const review = createReview('record-1');

    await repository.saveReview(review);

    await expect(repository.saveReview(review)).rejects.toThrow(
      'Record quality review already exists',
    );
    await expect(repository.updateReview(createReview('missing-record'))).rejects.toThrow(
      'Record quality review not found',
    );
    await expect(store.list()).resolves.toHaveLength(1);
  });
});
