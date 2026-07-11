import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { TableDailyRecordPage, type DailyRecordRepository } from '@/features/daily';
import { TESTIDS } from '@/testids';

vi.mock('@/lib/nav/useCancelToDashboard', () => ({
  useCancelToToday: () => vi.fn(),
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
        showMissingOnly: false,
        setShowMissingOnly: vi.fn(),
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

vi.mock('@/features/daily/components/pages/FullScreenDailyDialogPage', () => ({
  FullScreenDailyDialogPage: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('/daily/table route', () => {
  it('renders the table daily record form immediately', () => {
    const repository = createRepository();
    render(
      <MemoryRouter initialEntries={['/daily/table']}>
        <Routes>
          <Route path="/daily/table" element={<TableDailyRecordPage repository={repository} />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId(TESTIDS['daily-table-record-form'])).toBeInTheDocument();
  });
});

function createRepository(): DailyRecordRepository {
  return {
    save: vi.fn(async () => undefined),
    load: vi.fn(async () => null),
    list: vi.fn(async () => []),
    approve: vi.fn(async () => {
      throw new Error('not used');
    }),
    scanIntegrity: vi.fn(async () => []),
  };
}
