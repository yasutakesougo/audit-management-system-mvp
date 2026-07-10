import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createRecordQualityReviewDraft,
  type RecordQualityReviewDraft,
} from '@/features/record-quality/domain/recordQualityReview';
import { InMemoryRecordQualityHumanReviewQueueRepository } from '@/features/record-quality/adapters/in-memory/inMemoryRecordQualityHumanReviewQueueRepository';
import {
  InMemoryRecordQualityReviewRepository,
  type RecordQualityReviewRepository,
} from '@/features/record-quality/adapters/in-memory/inMemoryRecordQualityReviewRepository';
import { useRecordQualityHumanReviewWorkflow } from '../useRecordQualityHumanReviewWorkflow';

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

function createWorkflowRepositories(seed: readonly RecordQualityReviewDraft[]) {
  const reviewRepository = new InMemoryRecordQualityReviewRepository(seed);
  const queueRepository = new InMemoryRecordQualityHumanReviewQueueRepository(
    reviewRepository,
  );

  return { reviewRepository, queueRepository };
}

describe('useRecordQualityHumanReviewWorkflow', () => {
  it('accepts review metadata through the injected review repository and reloads the queue', async () => {
    const repositories = createWorkflowRepositories([
      createReview('record-accepted', '2026-06-11T00:00:00.000Z'),
    ]);

    const { result } = renderHook(() =>
      useRecordQualityHumanReviewWorkflow(repositories),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.queue.items.map(item => item.recordId)).toEqual([
      'record-accepted',
    ]);

    await act(async () => {
      await result.current.accept({
        recordId: 'record-accepted',
        updatedAt: '2026-06-11T01:00:00.000Z',
      });
    });

    expect(result.current.decisionError).toBeNull();
    expect(result.current.isDeciding).toBe(false);
    expect(result.current.queue.items).toEqual([]);
    await expect(repositories.reviewRepository.getReview('record-accepted')).resolves.toMatchObject({
      status: 'accepted',
      updatedAt: '2026-06-11T01:00:00.000Z',
      sourceOfTruth: 'original_record',
      outputKind: 'review_metadata',
      requiresHumanReview: true,
    });
  });

  it('revises review metadata and keeps the item active in the reloaded queue', async () => {
    const repositories = createWorkflowRepositories([
      createReview('record-revised', '2026-06-11T00:00:00.000Z'),
    ]);

    const { result } = renderHook(() =>
      useRecordQualityHumanReviewWorkflow(repositories),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.revise({
        recordId: 'record-revised',
        notes: ['人間レビューで確認観点だけを修正する'],
        updatedAt: '2026-06-11T02:00:00.000Z',
      });
    });

    expect(result.current.decisionError).toBeNull();
    expect(result.current.queue.items.map(item => item.recordId)).toEqual([
      'record-revised',
    ]);
    expect(result.current.queue.items[0]).toMatchObject({
      status: 'revised',
      sourceRecordId: 'record-revised',
      sourceOfTruth: 'original_record',
      outputKind: 'review_metadata',
      requiresHumanReview: true,
    });
    await expect(repositories.reviewRepository.getReview('record-revised')).resolves.toMatchObject({
      status: 'revised',
      notes: ['人間レビューで確認観点だけを修正する'],
      updatedAt: '2026-06-11T02:00:00.000Z',
    });
  });

  it('discards review metadata and removes the item from the reloaded queue', async () => {
    const repositories = createWorkflowRepositories([
      createReview('record-discarded', '2026-06-11T00:00:00.000Z'),
    ]);

    const { result } = renderHook(() =>
      useRecordQualityHumanReviewWorkflow(repositories),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.discard({
        recordId: 'record-discarded',
        updatedAt: '2026-06-11T03:00:00.000Z',
      });
    });

    expect(result.current.decisionError).toBeNull();
    expect(result.current.queue.items).toEqual([]);
    await expect(repositories.reviewRepository.getReview('record-discarded')).resolves.toMatchObject({
      status: 'discarded',
      updatedAt: '2026-06-11T03:00:00.000Z',
      originalRecord: { recordId: 'record-discarded' },
    });
  });

  it('reports decision errors without reloading or clearing the current queue', async () => {
    const reviewRepository = {
      getReview: vi.fn().mockRejectedValue(new Error('decision failed')),
      saveReview: vi.fn(),
      updateReview: vi.fn(),
      listReviews: vi.fn(),
    } satisfies RecordQualityReviewRepository;
    const queueRepository = {
      listActiveQueue: vi.fn().mockResolvedValue({
        items: [
          {
            recordId: 'record-1',
            sourceRecordId: 'record-1',
            status: 'draft',
            label: 'pending human review',
            suggestedCategoryCount: 1,
            missingInformationHintCount: 1,
            noteCount: 1,
            sourceOfTruth: 'original_record',
            outputKind: 'review_metadata',
            requiresHumanReview: true,
            updatedAt: '2026-06-11T00:00:00.000Z',
          },
        ],
        totalCount: 1,
        oldestUpdatedAt: '2026-06-11T00:00:00.000Z',
      }),
    };

    const { result } = renderHook(() =>
      useRecordQualityHumanReviewWorkflow({ reviewRepository, queueRepository }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.accept({
        recordId: 'record-1',
        updatedAt: '2026-06-11T01:00:00.000Z',
      });
    });

    expect(result.current.decisionError?.message).toBe('decision failed');
    expect(result.current.isDeciding).toBe(false);
    expect(result.current.queue.items.map(item => item.recordId)).toEqual(['record-1']);
    expect(queueRepository.listActiveQueue).toHaveBeenCalledTimes(1);
    expect(reviewRepository.updateReview).not.toHaveBeenCalled();
  });
});
