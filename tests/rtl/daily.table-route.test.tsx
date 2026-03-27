import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import TableDailyRecordPage from '@/features/daily/components/table/TableDailyRecordPage';
import { TESTIDS } from '@/testids';

vi.mock('@/features/daily/components/table/useTableDailyRecordViewModel', () => ({
  useTableDailyRecordViewModel: () => ({
    open: true,
    title: '一覧形式ケース記録',
    backTo: '/today',
    testId: TESTIDS['daily-table-record-page'],
    onClose: vi.fn(),
    onSave: vi.fn(async () => {}),
  }),
}));

vi.mock('@/features/daily/hooks/view-models/useTableDailyRecordForm', () => ({
  useTableDailyRecordForm: () =>
    ({
      header: {
        formData: {
          date: '2026-03-23',
          reporter: { name: '', role: '生活支援員' },
        },
        setFormData: vi.fn(),
      },
      picker: {
        selectedUserIds: [],
      },
      table: {
        unsentRowCount: 0,
        showUnsentOnly: false,
        setShowUnsentOnly: vi.fn(),
      },
      draft: {
        hasDraft: false,
        draftSavedAt: null,
        handleSaveDraft: vi.fn(),
      },
      actions: {
        saving: false,
        handleSave: vi.fn(async () => {}),
      },
    }) as unknown,
}));

vi.mock('@/features/daily/components/forms/TableDailyRecordForm', () => ({
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
