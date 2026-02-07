import { axe, toHaveNoViolations } from 'jest-axe';
import { render } from '@testing-library/react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import RecordList from '@/features/records/RecordList';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '@/hooks/useToast';

expect.extend(toHaveNoViolations);

const noop = async () => undefined;

/**
 * RecordList Accessibility Tests (#340)
 *
 * Verifies RecordList component has no axe violations
 * in empty state and with mock data
 */
describe('RecordList Accessibility', () => {
  beforeEach(() => {
    vi.mock('@/features/records/api', () => ({
      useRecordsApi: () => ({
        list: vi.fn().mockResolvedValue([]),
        add: vi.fn(noop),
      }),
    }));
  });

  test('has no a11y violations (empty state)', async () => {
    const { container } = render(
      <MemoryRouter>
        <ToastProvider>
          <RecordList records={[]} isLoading={false} error={null} />
        </ToastProvider>
      </MemoryRouter>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('has no a11y violations (with mock data)', async () => {
    const mockRecords = [
      {
        id: '1',
        recordDate: '2024-01-01',
        recordType: 'daily',
        userId: 'U-001',
        userFullName: 'テスト太郎',
        content: 'Test record content',
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-01T10:00:00Z',
      },
      {
        id: '2',
        recordDate: '2024-01-02',
        recordType: 'daily',
        userId: 'U-002',
        userFullName: 'テスト次郎',
        content: 'Another test record',
        createdAt: '2024-01-02T10:00:00Z',
        updatedAt: '2024-01-02T10:00:00Z',
      },
    ];

    const { container } = render(
      <MemoryRouter>
        <ToastProvider>
          <RecordList records={mockRecords} isLoading={false} error={null} />
        </ToastProvider>
      </MemoryRouter>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('has no a11y violations (loading state)', async () => {
    const { container } = render(
      <MemoryRouter>
        <ToastProvider>
          <RecordList records={[]} isLoading={true} error={null} />
        </ToastProvider>
      </MemoryRouter>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  test('has no a11y violations (error state)', async () => {
    const { container } = render(
      <MemoryRouter>
        <ToastProvider>
          <RecordList
            records={[]}
            isLoading={false}
            error={new Error('Failed to load records')}
          />
        </ToastProvider>
      </MemoryRouter>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
