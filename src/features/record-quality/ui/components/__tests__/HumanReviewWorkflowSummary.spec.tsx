import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import {
  createRecordQualityReviewDraft,
  type RecordQualityReviewDraft,
} from '@/features/record-quality/domain/recordQualityReview';
import {
  buildRecordQualityHumanReviewQueue,
  InMemoryRecordQualityHumanReviewQueueRepository,
  type RecordQualityHumanReviewQueueRepository,
} from '@/features/record-quality/adapters/in-memory/inMemoryRecordQualityHumanReviewQueueRepository';
import {
  InMemoryRecordQualityReviewRepository,
  type RecordQualityReviewRepository,
} from '@/features/record-quality/adapters/in-memory/inMemoryRecordQualityReviewRepository';
import { HumanReviewWorkflowSummary } from '../HumanReviewWorkflowSummary';

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

function createRepositories(seed: readonly RecordQualityReviewDraft[]) {
  const reviewRepository = new InMemoryRecordQualityReviewRepository(seed);
  const queueRepository = new InMemoryRecordQualityHumanReviewQueueRepository(
    reviewRepository,
  );

  return { reviewRepository, queueRepository };
}

async function clickAndFlush(
  user: ReturnType<typeof userEvent.setup>,
  button: HTMLElement,
) {
  await act(async () => {
    await user.click(button);
    await Promise.resolve();
  });
}

describe('HumanReviewWorkflowSummary', () => {
  it('accepts a review from the action controls and removes it from the active queue', async () => {
    const user = userEvent.setup();
    const repositories = createRepositories([
      createReview('record-accepted', '2026-06-11T00:00:00.000Z'),
    ]);

    render(
      <HumanReviewWorkflowSummary
        {...repositories}
        getUpdatedAt={() => '2026-06-11T01:00:00.000Z'}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('record-quality-human-review-count')).toHaveTextContent(
        '要確認 1件',
      ),
    );

    await clickAndFlush(user, screen.getByRole('button', { name: '採用' }));

    await waitFor(() =>
      expect(screen.getByTestId('record-quality-human-review-empty')).toHaveTextContent(
        '要人間レビューはありません',
      ),
    );
    await expect(repositories.reviewRepository.getReview('record-accepted')).resolves.toMatchObject({
      status: 'accepted',
      updatedAt: '2026-06-11T01:00:00.000Z',
      sourceOfTruth: 'original_record',
      outputKind: 'review_metadata',
      requiresHumanReview: true,
    });
  });

  it('revises a review from the action controls and keeps it visible as active review metadata', async () => {
    const user = userEvent.setup();
    const repositories = createRepositories([
      createReview('record-revised', '2026-06-11T00:00:00.000Z'),
    ]);

    render(
      <HumanReviewWorkflowSummary
        {...repositories}
        getUpdatedAt={() => '2026-06-11T02:00:00.000Z'}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('record-quality-human-review-count')).toHaveTextContent(
        '要確認 1件',
      ),
    );

    await clickAndFlush(user, screen.getByRole('button', { name: '修正済み' }));

    const item = await screen.findByTestId(
      'record-quality-human-review-item-record-revised',
    );
    expect(within(item).getByText('revised by human reviewer')).toBeInTheDocument();
    expect(within(item).queryByText('元の支援記録本文')).not.toBeInTheDocument();
    await expect(repositories.reviewRepository.getReview('record-revised')).resolves.toMatchObject({
      status: 'revised',
      notes: ['人間レビューで確認観点を修正済み'],
      updatedAt: '2026-06-11T02:00:00.000Z',
    });
  });

  it('discards a review from the action controls and removes it from the active queue', async () => {
    const user = userEvent.setup();
    const repositories = createRepositories([
      createReview('record-discarded', '2026-06-11T00:00:00.000Z'),
    ]);

    render(
      <HumanReviewWorkflowSummary
        {...repositories}
        getUpdatedAt={() => '2026-06-11T03:00:00.000Z'}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId('record-quality-human-review-count')).toHaveTextContent(
        '要確認 1件',
      ),
    );

    await clickAndFlush(user, screen.getByRole('button', { name: '破棄' }));

    await waitFor(() =>
      expect(screen.getByTestId('record-quality-human-review-empty')).toBeInTheDocument(),
    );
    await expect(repositories.reviewRepository.getReview('record-discarded')).resolves.toMatchObject({
      status: 'discarded',
      updatedAt: '2026-06-11T03:00:00.000Z',
      originalRecord: { recordId: 'record-discarded' },
    });
  });

  it('keeps decision failures in a safe UI error without exposing the raw backend message', async () => {
    const user = userEvent.setup();
    const reviewRepository = {
      getReview: vi.fn().mockRejectedValue(new Error('raw decision failure')),
      saveReview: vi.fn(),
      updateReview: vi.fn(),
      listReviews: vi.fn(),
    } satisfies RecordQualityReviewRepository;
    const queueRepository = {
      listActiveQueue: vi.fn().mockResolvedValue(
        buildRecordQualityHumanReviewQueue([
          createReview('record-failed', '2026-06-11T00:00:00.000Z'),
        ]),
      ),
    } satisfies RecordQualityHumanReviewQueueRepository;

    render(
      <HumanReviewWorkflowSummary
        reviewRepository={reviewRepository}
        queueRepository={queueRepository}
        getUpdatedAt={() => '2026-06-11T04:00:00.000Z'}
      />,
    );

    await waitFor(() => expect(screen.getByText('record-failed')).toBeInTheDocument());

    await clickAndFlush(user, screen.getByRole('button', { name: '採用' }));

    await waitFor(() =>
      expect(
        screen.getByTestId('record-quality-human-review-decision-error'),
      ).toHaveTextContent('レビュー判断を保存できませんでした'),
    );
    expect(screen.queryByText('raw decision failure')).not.toBeInTheDocument();
    expect(screen.getByText('record-failed')).toBeInTheDocument();
    expect(queueRepository.listActiveQueue).toHaveBeenCalledTimes(1);
    expect(reviewRepository.updateReview).not.toHaveBeenCalled();
  });
});
