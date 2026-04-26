import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TransportAssignmentPage from '@/pages/TransportAssignmentPage';

vi.mock('@/utils/getNow', () => ({
  toLocalDateISO: vi.fn(() => '2026-03-25'),
}));

vi.mock('@/features/schedules/hooks/legacy/useSchedules', () => ({
  useSchedules: vi.fn(() => ({
    items: [
      {
        id: 'row-1',
        etag: '"1"',
        title: '送迎（往路）',
        category: 'User',
        start: '2026-03-25T09:00:00+09:00',
        end: '2026-03-25T09:30:00+09:00',
        serviceType: 'transport',
        userId: 'U001',
        userName: '田中太郎',
        vehicleId: '車両2',
      },
      {
        id: 'row-2',
        etag: '"2"',
        title: '送迎（往路）',
        category: 'User',
        start: '2026-03-25T09:10:00+09:00',
        end: '2026-03-25T09:40:00+09:00',
        serviceType: 'transport',
        userId: 'U002',
        userName: '山田花子',
      },
      {
        id: 'row-3',
        etag: '"3"',
        title: '送迎（往路）',
        category: 'User',
        start: '2026-03-18T09:10:00+09:00',
        end: '2026-03-18T09:40:00+09:00',
        serviceType: 'transport',
        userId: 'U002',
        userName: '山田花子',
        vehicleId: '車両3',
        assignedStaffId: 'STF-002',
      },
    ],
    loading: false,
  })),
}));

vi.mock('@/features/users/useUsers', () => ({
  useUsers: vi.fn(() => ({
    data: [
      { UserID: 'U001', FullName: '田中太郎' },
      { UserID: 'U002', FullName: '山田花子' },
    ],
    status: 'success',
  })),
}));

vi.mock('@/features/staff/store', () => ({
  useStaffStore: vi.fn(() => ({
    data: [
      { id: 1, staffId: 'STF-001', name: '佐藤花子' },
      { id: 2, staffId: 'STF-002', name: '鈴木次郎' },
    ],
    loading: false,
  })),
}));

describe('TransportAssignmentPage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders transport assignment board and controls', async () => {
    await act(async () => {
      render(
        <MemoryRouter>
          <TransportAssignmentPage />
        </MemoryRouter>,
      );
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: '送迎配車表' })).toBeInTheDocument();
    });

    expect(screen.getByTestId('transport-assignment-date')).toBeInTheDocument();
    expect(screen.getByTestId('transport-assignment-week-prev')).toBeInTheDocument();
    expect(screen.getByTestId('transport-assignment-week-next')).toBeInTheDocument();
    expect(screen.getByTestId('transport-assignment-week-range')).toBeInTheDocument();
    expect(screen.getByTestId('transport-assignment-weekdays')).toBeInTheDocument();
    expect(screen.getByTestId('transport-assignment-apply-weekday-default')).toBeInTheDocument();
    expect(screen.getByTestId('transport-assignment-apply-week-bulk-default')).toBeInTheDocument();
    expect(screen.getByTestId('transport-assignment-direction')).toBeInTheDocument();
    expect(screen.queryByTestId('transport-assignment-week-bulk-summary')).not.toBeInTheDocument();

    const weekdayGroup = screen.getByTestId('transport-assignment-weekdays');
    const weekdayButtons = within(weekdayGroup).getAllByRole('button');
    expect(weekdayButtons).toHaveLength(5);
    expect(within(weekdayGroup).queryByRole('button', { name: /土/ })).not.toBeInTheDocument();
    expect(within(weekdayGroup).queryByRole('button', { name: /日/ })).not.toBeInTheDocument();

    for (let i = 1; i <= 4; i += 1) {
      expect(screen.getByTestId(`transport-assignment-vehicle-card-${i}`)).toBeInTheDocument();
    }
    expect(screen.getByTestId('transport-assignment-unassigned-placeholder')).toBeInTheDocument();
    expect(screen.getByTestId('transport-assignment-payload-count')).toBeInTheDocument();
    expect(screen.getByTestId('transport-assignment-save-button')).toBeDisabled();
    expect(screen.getByTestId('transport-assignment-insight-missing_driver')).toBeInTheDocument();
    expect(screen.getByTestId('transport-assignment-vehicle-warning-2')).toBeInTheDocument();
    expect(screen.getByTestId('transport-assignment-course-select-1')).toBeInTheDocument();
    expect(screen.getByTestId('transport-assignment-attendant-select-1')).toBeInTheDocument();
    expect(screen.getByTestId('transport-assignment-vehicle-name-input-1')).toHaveValue('ブルー');
    expect(screen.getByTestId('transport-assignment-vehicle-name-input-2')).toHaveValue('シルバー');
    expect(screen.getByTestId('transport-assignment-vehicle-name-input-3')).toHaveValue('ハイエース');
    expect(screen.getByTestId('transport-assignment-vehicle-name-input-4')).toHaveValue('スクラム');

    const backLink = screen.getByTestId('transport-assignment-back-today');
    expect(backLink).toHaveAttribute('href', '/today');

    const vehicleNameInput = screen.getByTestId('transport-assignment-vehicle-name-input-1');
    await act(async () => {
      fireEvent.change(vehicleNameInput, { target: { value: '青1号' } });
      fireEvent.blur(vehicleNameInput);
    });

    expect(screen.getByTestId('transport-assignment-vehicle-name-input-1')).toHaveValue('青1号');
    expect(localStorage.getItem('transport.vehicle-name-overrides.v1')).toContain('青1号');

    await act(async () => {
      fireEvent.click(screen.getByTestId('transport-assignment-apply-week-bulk-default'));
    });

    expect(screen.getByTestId('transport-assignment-week-bulk-summary')).toBeInTheDocument();
    expect(screen.getByTestId('transport-assignment-save-button')).toBeEnabled();
  });
});
