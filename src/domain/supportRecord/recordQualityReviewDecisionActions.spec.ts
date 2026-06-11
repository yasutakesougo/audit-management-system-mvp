import { describe, expect, it } from 'vitest';

import { buildRecordQualityHumanReviewQueue } from './recordQualityHumanReviewQueue';
import {
  createRecordQualityReviewDraft,
  type RecordQualityReviewDraft,
} from './recordQualityReview';
import {
  acceptRecordQualityReviewDecision,
  discardRecordQualityReviewDecision,
  reviseRecordQualityReviewDecision,
} from './recordQualityReviewDecisionActions';
import { InMemoryRecordQualityReviewRepository } from './recordQualityReviewRepository';

const timestamp = '2026-06-11T00:00:00.000Z';

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
    createdAt: timestamp,
  });
}

describe('record quality human review decision actions', () => {
  it('accepts review metadata without mutating the original support record', async () => {
    const repository = new InMemoryRecordQualityReviewRepository();
    const originalSupportRecord = {
      id: 'record-accepted',
      body: '元の支援記録本文',
      content: '本人の反応などの本文',
    };
    const originalSnapshot = structuredClone(originalSupportRecord);
    const saved = await repository.saveReview(createReview(originalSupportRecord.id));

    const accepted = await acceptRecordQualityReviewDecision({
      repository,
      recordId: saved.recordId,
      updatedAt: '2026-06-11T01:00:00.000Z',
    });
    const queue = buildRecordQualityHumanReviewQueue(await repository.listReviews());

    expect(originalSupportRecord).toEqual(originalSnapshot);
    expect(accepted).toMatchObject({
      recordId: originalSupportRecord.id,
      originalRecord: { recordId: originalSupportRecord.id },
      status: 'accepted',
      sourceOfTruth: 'original_record',
      outputKind: 'review_metadata',
      requiresHumanReview: true,
      updatedAt: '2026-06-11T01:00:00.000Z',
    });
    expect('body' in accepted).toBe(false);
    expect('content' in accepted).toBe(false);
    expect('originalText' in accepted).toBe(false);
    expect(queue.items.map(item => item.recordId)).not.toContain(originalSupportRecord.id);
  });

  it('revises review metadata and keeps the review in the active human review queue', async () => {
    const repository = new InMemoryRecordQualityReviewRepository();
    const saved = await repository.saveReview(createReview('record-revised'));

    const revised = await reviseRecordQualityReviewDecision({
      repository,
      recordId: saved.recordId,
      notes: ['人間レビューで確認観点だけを修正する'],
      updatedAt: '2026-06-11T02:00:00.000Z',
    });
    const queue = buildRecordQualityHumanReviewQueue(await repository.listReviews());

    expect(revised).toMatchObject({
      recordId: 'record-revised',
      originalRecord: { recordId: 'record-revised' },
      status: 'revised',
      notes: ['人間レビューで確認観点だけを修正する'],
      sourceOfTruth: 'original_record',
      outputKind: 'review_metadata',
      requiresHumanReview: true,
      updatedAt: '2026-06-11T02:00:00.000Z',
    });
    expect(queue.items.map(item => item.recordId)).toEqual(['record-revised']);
    expect(queue.items[0]).toMatchObject({
      status: 'revised',
      sourceRecordId: 'record-revised',
      sourceOfTruth: 'original_record',
      outputKind: 'review_metadata',
      requiresHumanReview: true,
    });
    expect('body' in queue.items[0]).toBe(false);
    expect('content' in queue.items[0]).toBe(false);
    expect('originalText' in queue.items[0]).toBe(false);
  });

  it('discards review metadata without deleting or overwriting the original record reference', async () => {
    const repository = new InMemoryRecordQualityReviewRepository();
    const saved = await repository.saveReview(createReview('record-discarded'));

    const discarded = await discardRecordQualityReviewDecision({
      repository,
      recordId: saved.recordId,
      updatedAt: '2026-06-11T03:00:00.000Z',
    });
    const stored = await repository.getReview('record-discarded');
    const queue = buildRecordQualityHumanReviewQueue(await repository.listReviews());

    expect(stored).toEqual(discarded);
    expect(discarded).toMatchObject({
      recordId: 'record-discarded',
      originalRecord: { recordId: 'record-discarded' },
      status: 'discarded',
      sourceOfTruth: 'original_record',
      outputKind: 'review_metadata',
      requiresHumanReview: true,
      updatedAt: '2026-06-11T03:00:00.000Z',
    });
    expect(discarded.prohibitedActions).toEqual([
      'diagnose_users',
      'judge_behavior',
      'determine_support_policy',
      'overwrite_original_record',
    ]);
    expect(queue.items.map(item => item.recordId)).not.toContain('record-discarded');
  });

  it('rejects actions for missing review metadata without creating a new review', async () => {
    const repository = new InMemoryRecordQualityReviewRepository();

    await expect(
      acceptRecordQualityReviewDecision({
        repository,
        recordId: 'missing-record',
        updatedAt: '2026-06-11T04:00:00.000Z',
      }),
    ).rejects.toThrow('Record quality review not found');
    await expect(repository.listReviews()).resolves.toEqual([]);
  });
});
