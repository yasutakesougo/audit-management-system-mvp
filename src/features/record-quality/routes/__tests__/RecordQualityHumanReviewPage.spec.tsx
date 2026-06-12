import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import RecordQualityHumanReviewPage from '../RecordQualityHumanReviewPage';

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
  it('composes the human review workflow summary with route-level repositories', async () => {
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
    expect(screen.queryByText('元の支援記録本文')).not.toBeInTheDocument();
  });

  it('keeps the route-level workflow interactive without persisting original record text', async () => {
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
  });
});
