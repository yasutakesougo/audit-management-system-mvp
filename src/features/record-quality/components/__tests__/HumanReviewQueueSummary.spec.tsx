import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  createRecordQualityReviewDraft,
  reviseRecordQualityReviewDraft,
  type RecordQualityReviewDraft,
} from '@/domain/supportRecord/recordQualityReview';
import {
  buildRecordQualityHumanReviewQueue,
  InMemoryRecordQualityHumanReviewQueueRepository,
  type RecordQualityHumanReviewQueueRepository,
} from '@/domain/supportRecord/recordQualityHumanReviewQueue';
import { InMemoryRecordQualityReviewRepository } from '@/domain/supportRecord/recordQualityReviewRepository';
import { HumanReviewQueueSummary } from '../HumanReviewQueueSummary';

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

describe('HumanReviewQueueSummary', () => {
  it('renders loading and then active queue summary without original record text', async () => {
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

    render(<HumanReviewQueueSummary repository={queueRepository} />);

    expect(screen.getByRole('status')).toHaveTextContent('要人間レビューを読み込み中');

    await waitFor(() =>
      expect(screen.getByTestId('record-quality-human-review-count')).toHaveTextContent(
        '要確認 2件',
      ),
    );

    expect(screen.getByText('record-draft')).toBeInTheDocument();
    expect(screen.getByText('record-revised')).toBeInTheDocument();
    expect(screen.getByText('最古更新 2026-06-11T00:00:00.000Z')).toBeInTheDocument();
    expect(screen.queryByText('元の支援記録本文')).not.toBeInTheDocument();
    expect(screen.queryByText('本人の反応などの本文')).not.toBeInTheDocument();
    expect(screen.queryByText('original text')).not.toBeInTheDocument();
  });

  it('renders an empty state when the active queue is empty', async () => {
    const queueRepository = {
      listActiveQueue: vi.fn().mockResolvedValue(
        buildRecordQualityHumanReviewQueue([]),
      ),
    } satisfies RecordQualityHumanReviewQueueRepository;

    render(<HumanReviewQueueSummary repository={queueRepository} />);

    await waitFor(() =>
      expect(screen.getByTestId('record-quality-human-review-empty')).toHaveTextContent(
        '要人間レビューはありません',
      ),
    );
  });

  it('renders an error state without exposing the raw error message', async () => {
    const queueRepository = {
      listActiveQueue: vi.fn().mockRejectedValue(new Error('raw backend failure')),
    } satisfies RecordQualityHumanReviewQueueRepository;

    render(<HumanReviewQueueSummary repository={queueRepository} />);

    await waitFor(() =>
      expect(screen.getByTestId('record-quality-human-review-error')).toHaveTextContent(
        '要人間レビューを読み込めませんでした',
      ),
    );
    expect(screen.queryByText('raw backend failure')).not.toBeInTheDocument();
  });
});
