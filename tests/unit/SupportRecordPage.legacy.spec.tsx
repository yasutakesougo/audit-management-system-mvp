import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import SupportRecordPage from '@/pages/SupportRecordPage';

describe('SupportRecordPage legacy banner', () => {
  it('shows legacy banner and back link', () => {
    render(
      <MemoryRouter>
        <SupportRecordPage />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('support-record-legacy-banner')).toBeInTheDocument();
    const backButton = screen.getByTestId('support-record-legacy-back');
    expect(backButton).toBeInTheDocument();
    expect(backButton).toHaveAttribute('href', '/daily/activity');
  });
});
