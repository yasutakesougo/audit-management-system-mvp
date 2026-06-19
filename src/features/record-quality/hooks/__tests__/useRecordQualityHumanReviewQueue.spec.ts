import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createRecordQualityReviewDraft,
  reviseRecordQualityReviewDraft,
  type RecordQualityReviewDraft,
} from '@/domain/supportRecord/recordQualityReview';
import {
  emptyRecordQualityHumanReviewQueueSummary,
  InMemoryRecordQualityHumanReviewQueueRepository,
  type RecordQualityHumanReviewQueueRepository,
} from '@/domain/supportRecord/recordQualityHumanReviewQueue';
import { InMemoryRecordQualityReviewRepository } from '@/domain/supportRecord/recordQualityReviewRepository';
import { useRecordQualityHumanReviewQueue } from '../useRecordQualityHumanReviewQueue';

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

describe('useRecordQualityHumanReviewQueue', () => {
  it('loads active queue items from the injected use case boundary', async () => {
    const draftWithOriginalText = {
      ...createReview('record-draft', '2026-06-11T00:00:00.000Z'),
      body: '元の支援記録本文',
      content: '本人の反応などの本文',
      originalText: 'original text',
    } as RecordQualityReviewDraft & {
      body: string;
      content: string;
      originalText: string;
    };
    const reviewRepository = new InMemoryRecordQualityReviewRepository([
      reviseRecordQualityReviewDraft(
        createReview('record-revised', '2026-06-11T01:00:00.000Z'),
        {
          notes: ['人間レビューで修正済みだが再確認する'],
          updatedAt: '2026-06-11T02:00:00.000Z',
        },
      ),
      draftWithOriginalText,
    ]);
    const queueRepository = new InMemoryRecordQualityHumanReviewQueueRepository(
      reviewRepository,
    );

    const { result } = renderHook(() =>
      useRecordQualityHumanReviewQueue(queueRepository),
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.queue.totalCount).toBe(2);
    expect(result.current.queue.summary).toEqual({
      draftCount: 1,
      revisedCount: 1,
      acceptedCount: 0,
      discardedCount: 0,
      pendingTotalCount: 2,
      reviewedTotalCount: 0,
    });
    expect(result.current.queue.items.map(item => item.recordId)).toEqual([
      'record-draft',
      'record-revised',
    ]);
    expect(result.current.queue.items.every(item => item.requiresHumanReview)).toBe(true);
    expect(result.current.queue.items.some(item => 'body' in item)).toBe(false);
    expect(result.current.queue.items.some(item => 'content' in item)).toBe(false);
    expect(result.current.queue.items.some(item => 'originalText' in item)).toBe(false);
  });

  it('returns an empty loaded state when no queue items are active', async () => {
    const queueRepository = {
      listActiveQueue: vi.fn().mockResolvedValue({
        items: [],
        totalCount: 0,
        oldestUpdatedAt: undefined,
        summary: emptyRecordQualityHumanReviewQueueSummary,
      }),
    } satisfies RecordQualityHumanReviewQueueRepository;

    const { result } = renderHook(() =>
      useRecordQualityHumanReviewQueue(queueRepository),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.queue).toEqual({
      items: [],
      totalCount: 0,
      oldestUpdatedAt: undefined,
      summary: emptyRecordQualityHumanReviewQueueSummary,
    });
    expect(result.current.error).toBeNull();
  });

  it('returns an empty queue and error state when loading fails', async () => {
    const queueRepository = {
      listActiveQueue: vi.fn().mockRejectedValue(new Error('queue failed')),
    } satisfies RecordQualityHumanReviewQueueRepository;

    const { result } = renderHook(() =>
      useRecordQualityHumanReviewQueue(queueRepository),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.queue).toEqual({
      items: [],
      totalCount: 0,
      oldestUpdatedAt: undefined,
      summary: emptyRecordQualityHumanReviewQueueSummary,
    });
    expect(result.current.error?.message).toBe('queue failed');
  });
});
