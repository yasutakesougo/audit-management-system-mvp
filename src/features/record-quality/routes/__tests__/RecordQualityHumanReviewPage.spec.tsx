import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mocked } from 'vitest';

import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import RecordQualityHumanReviewPage from '../RecordQualityHumanReviewPage';

const provider = vi.hoisted(() => ({
  current: null as Mocked<IDataProvider> | null,
}));

vi.mock('@/lib/data/useDataProvider', () => ({
  useDataProvider: () => ({
    provider: provider.current,
    type: 'sharepoint',
  }),
}));

async function clickAndFlush(
  user: ReturnType<typeof userEvent.setup>,
  button: HTMLElement,
) {
  await act(async () => {
    await user.click(button);
    await Promise.resolve();
  });
}

describe('RecordQualityHumanReviewPage', () => {
  beforeEach(() => {
    provider.current = makeProvider([
      createRow({
        id: 1,
        recordId: 'review-1',
        sourceRecordId: 'support-record-review-1',
        status: 'draft',
        updatedAt: '2026-06-11T00:00:00.000Z',
      }),
      createRow({
        id: 2,
        recordId: 'review-2',
        sourceRecordId: 'support-record-review-2',
        status: 'revised',
        notes: ['確認観点を修正済み'],
        updatedAt: '2026-06-11T02:00:00.000Z',
      }),
      createRow({
        id: 3,
        recordId: 'review-3',
        sourceRecordId: 'support-record-review-3',
        status: 'accepted',
        updatedAt: '2026-06-11T03:00:00.000Z',
      }),
    ]);
  });

  it('composes the human review workflow summary with the data provider repository', async () => {
    render(<RecordQualityHumanReviewPage />);

    expect(
      screen.getByRole('heading', { level: 1, name: '記録品質レビュー' }),
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByTestId('record-quality-human-review-count')).toHaveTextContent(
        '要確認 2件',
      ),
    );

    expect(screen.getByText('support-record-review-1')).toBeInTheDocument();
    expect(screen.getByText('support-record-review-2')).toBeInTheDocument();
    expect(screen.queryByText('support-record-review-3')).not.toBeInTheDocument();
    expect(screen.queryByText('元の支援記録本文')).not.toBeInTheDocument();

    expect(provider.current?.listItems).toHaveBeenCalledWith(
      'RecordQualityReview',
      expect.objectContaining({
        orderby: 'UpdatedAt asc',
      }),
    );
  });

  it('keeps the data provider workflow interactive without persisting original record text', async () => {
    const user = userEvent.setup();

    render(<RecordQualityHumanReviewPage />);

    await waitFor(() =>
      expect(screen.getByTestId('record-quality-human-review-count')).toHaveTextContent(
        '要確認 2件',
      ),
    );

    await clickAndFlush(user, screen.getAllByRole('button', { name: '採用' })[0]);

    await waitFor(() =>
      expect(screen.getByTestId('record-quality-human-review-count')).toHaveTextContent(
        '要確認 1件',
      ),
    );
    expect(screen.queryByText('support-record-review-1')).not.toBeInTheDocument();
    expect(screen.getByText('support-record-review-2')).toBeInTheDocument();
    expect(screen.queryByText('元の支援記録本文')).not.toBeInTheDocument();

    expect(provider.current?.updateItem).toHaveBeenCalledWith(
      'RecordQualityReview',
      1,
      expect.objectContaining({
        RecordId: 'review-1',
        SourceRecordId: 'support-record-review-1',
        ReviewStatus: 'accepted',
      }),
      { etag: '*' },
    );
    const [, , payload] = provider.current?.updateItem.mock.calls[0] ?? [];
    expect(payload).not.toHaveProperty('Body');
    expect(payload).not.toHaveProperty('OriginalRecordText');
  });
});

type RecordQualityReviewRow = {
  Id: number;
  Title: string;
  RecordId: string;
  SourceRecordId: string;
  ReviewStatus: string;
  ReviewerId: string | null;
  ReviewerName: string | null;
  SuggestedCategoriesJson: string;
  MissingInfoHintsJson: string;
  ReviewerNotesJson: string;
  CreatedAt: string;
  UpdatedAt: string;
};

function makeProvider(seed: RecordQualityReviewRow[]): Mocked<IDataProvider> {
  let rows = seed.map(row => ({ ...row }));
  const mockProvider: Mocked<IDataProvider> = {
    listItems: vi.fn(async (_resourceName, options) => {
      if (options?.filter?.includes('RecordId eq')) {
        const match = options.filter.match(/RecordId eq '([^']+)'/);
        const recordId = match?.[1];
        return rows.filter(row => row.RecordId === recordId);
      }

      return rows;
    }),
    getItemById: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(async (_resourceName, id, payload) => {
      rows = rows.map(row =>
        row.Id === id
          ? {
              ...row,
              ...payload,
            }
          : row,
      );
      return rows.find(row => row.Id === id) ?? {};
    }),
    deleteItem: vi.fn(),
    getMetadata: vi.fn(),
    getResourceNames: vi.fn(),
    getFieldInternalNames: vi.fn(),
    ensureListExists: vi.fn(),
    seed: vi.fn(),
  };

  return mockProvider;
}

function createRow({
  id,
  recordId,
  sourceRecordId,
  status,
  notes = ['人間レビューで確認する'],
  updatedAt,
}: {
  readonly id: number;
  readonly recordId: string;
  readonly sourceRecordId: string;
  readonly status: string;
  readonly notes?: readonly string[];
  readonly updatedAt: string;
}): RecordQualityReviewRow {
  return {
    Id: id,
    Title: recordId,
    RecordId: recordId,
    SourceRecordId: sourceRecordId,
    ReviewStatus: status,
    ReviewerId: null,
    ReviewerName: null,
    SuggestedCategoriesJson: JSON.stringify([
      {
        categoryId: 'staffSupportActions',
        matchedSignals: ['職員', '声かけ'],
        source: 'rule',
      },
    ]),
    MissingInfoHintsJson: JSON.stringify([
      {
        code: 'userResponseAfterSupport',
        label: '支援後の本人の反応',
        source: 'rule',
      },
    ]),
    ReviewerNotesJson: JSON.stringify(notes),
    CreatedAt: '2026-06-11T00:00:00.000Z',
    UpdatedAt: updatedAt,
  };
}
