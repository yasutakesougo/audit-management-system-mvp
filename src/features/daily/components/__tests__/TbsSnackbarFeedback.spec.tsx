import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TbsSnackbarFeedback from '../TbsSnackbarFeedback';

describe('TbsSnackbarFeedback', () => {
  it('renders success and error snackbar content', () => {
    render(
      <TbsSnackbarFeedback
        snackbarOpen
        snackbarMessage="保存しました"
        onSnackbarClose={vi.fn()}
        displayedError={new Error('保存に失敗しました')}
        onErrorClose={vi.fn()}
        hasRetry
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByText('保存しました')).toBeInTheDocument();
    expect(screen.getByText('Error: 保存に失敗しました')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '再送' })).toBeInTheDocument();
  });
});
