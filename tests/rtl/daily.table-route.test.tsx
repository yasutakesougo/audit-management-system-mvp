import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import TableDailyRecordPage from '@/features/daily/TableDailyRecordPage';
import { TESTIDS } from '@/testids';

vi.mock('@/features/daily/TableDailyRecordForm', () => ({
  TableDailyRecordForm: () => (
    <div data-testid={TESTIDS['daily-table-record-form']}>mock-table-form</div>
  ),
}));

describe('/daily/table route', () => {
  it('renders the table daily record form immediately', () => {
    render(
      <MemoryRouter initialEntries={['/daily/table']}>
        <Routes>
          <Route path="/daily/table" element={<TableDailyRecordPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId(TESTIDS['daily-table-record-form'])).toBeInTheDocument();
  });
});
