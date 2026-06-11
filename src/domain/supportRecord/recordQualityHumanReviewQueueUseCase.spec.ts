import { describe, expect, it } from 'vitest';

import {
  acceptRecordQualityReviewDraft,
  createRecordQualityReviewDraft,
  discardRecordQualityReviewDraft,
  reviseRecordQualityReviewDraft,
  type RecordQualityReviewDraft,
} from './recordQualityReview';
import {
  InMemoryRecordQualityHumanReviewQueueRepository,
  type RecordQualityHumanReviewQueueRepository,
} from './recordQualityHumanReviewQueue';
import { listRecordQualityHumanReviewQueue } from './recordQualityHumanReviewQueueUseCase';
import { InMemoryRecordQualityReviewRepository } from './recordQualityReviewRepository';

function createReview(recordId: string, createdAt: string): RecordQualityReviewDraft {
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
    createdAt,
  });
}

describe('listRecordQualityHumanReviewQueue', () => {
  it('returns the active human review queue from review metadata only', async () => {
    const reviewRepository = new InMemoryRecordQualityReviewRepository([
      createReview('record-oldest-draft', '2026-06-11T00:00:00.000Z'),
      acceptRecordQualityReviewDraft(
        createReview('record-accepted', '2026-06-11T01:00:00.000Z'),
        '2026-06-11T02:00:00.000Z',
      ),
      reviseRecordQualityReviewDraft(
        createReview('record-revised', '2026-06-11T03:00:00.000Z'),
        {
          notes: ['人間レビューで修正済みだが再確認する'],
          updatedAt: '2026-06-11T04:00:00.000Z',
        },
      ),
      discardRecordQualityReviewDraft(
        createReview('record-discarded', '2026-06-11T05:00:00.000Z'),
        '2026-06-11T06:00:00.000Z',
      ),
    ]);
    const queueRepository = new InMemoryRecordQualityHumanReviewQueueRepository(
      reviewRepository,
    );

    const queue = await listRecordQualityHumanReviewQueue({
      repository: queueRepository,
    });

    expect(queue.totalCount).toBe(2);
    expect(queue.oldestUpdatedAt).toBe('2026-06-11T00:00:00.000Z');
    expect(queue.items.map(item => item.recordId)).toEqual([
      'record-oldest-draft',
      'record-revised',
    ]);
    expect(queue.items.map(item => item.status)).toEqual(['draft', 'revised']);
    expect(queue.items.every(item => item.requiresHumanReview)).toBe(true);
    expect(queue.items.some(item => 'body' in item)).toBe(false);
    expect(queue.items.some(item => 'content' in item)).toBe(false);
    expect(queue.items.some(item => 'originalText' in item)).toBe(false);
  });

  it('delegates queue construction to the injected repository', async () => {
    const queueRepository = {
      async listActiveQueue() {
        return {
          items: [],
          totalCount: 0,
          oldestUpdatedAt: undefined,
        };
      },
    } satisfies RecordQualityHumanReviewQueueRepository;

    await expect(
      listRecordQualityHumanReviewQueue({ repository: queueRepository }),
    ).resolves.toEqual({
      items: [],
      totalCount: 0,
      oldestUpdatedAt: undefined,
    });
  });
});
