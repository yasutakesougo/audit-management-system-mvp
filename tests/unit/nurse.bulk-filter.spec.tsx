import BulkObservationList from '@/features/nurse/observation/BulkObservationList';
import { NURSE_USERS } from '@/features/nurse/users';
import { TESTIDS } from '@/testids';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
const mockSetDate = vi.fn();
const mockSetUser = vi.fn();

// Mock VitalCell to avoid dependency issues
vi.mock('@/features/nurse/observation/VitalCell', () => ({
  __esModule: true,
  default: ({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) => (
    <input
      id={id}
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      data-testid={id}
    />
  ),
}));

// Mock other complex dependencies
vi.mock('@/features/nurse/components/ShortcutHint', () => ({
  __esModule: true,
  default: () => <div data-testid="shortcut-hint">Shortcuts</div>,
}));

vi.mock('@/features/nurse/components/StatusLegend', () => ({
  __esModule: true,
  default: () => <div data-testid="status-legend">Legend</div>,
}));

vi.mock('@/features/nurse/state/offlineQueue', () => ({
  buildIdempotencyKey: vi.fn(() => 'mock-key'),
  queue: {
    add: vi.fn(() => ({ warned: false, size: 0 })),
  },
  QUEUE_MAX: 100,
}));

vi.mock('@/features/nurse/state/useNurseSync', () => ({
  flushNurseQueue: vi.fn(() => Promise.resolve({
    entries: [],
    summary: 'No changes',
  })),
}));

vi.mock('@/features/nurse/observation/useObsWorkspaceParams', () => ({
  useObsWorkspaceParams: () => ({
    date: '2025-11-12',
    user: 'I015',
    set: vi.fn(),
    setDate: mockSetDate,
    setUser: mockSetUser,
  }),
}));

vi.mock('@/features/nurse/state/useLastSync', () => ({
  useLastSync: () => ({
    summary: null,
  }),
}));

vi.mock('@/features/nurse/components/ToastContext', () => ({
  useToast: () => ({
    show: vi.fn(),
  }),
}));

describe('BulkObservationList weight-group filtering', () => {
  afterEach(() => {
    cleanup();
    mockSetDate.mockClear();
    mockSetUser.mockClear();
  });

  it('renders all active users when weightGroup is "all"', () => {
    render(<BulkObservationList weightGroup="all" />);

    // Count active users from NURSE_USERS
    const activeUsers = NURSE_USERS.filter((user) => user.isActive !== false);
    
    // Check that all active users are displayed
    activeUsers.forEach((user) => {
      expect(screen.getByTestId(`${TESTIDS.NURSE_BULK_ROW_PREFIX}-${user.id}`)).toBeInTheDocument();
      expect(screen.getByText(user.id)).toBeInTheDocument();
      if (user.name) {
        expect(screen.getByText(user.name)).toBeInTheDocument();
      }
    });

    // Verify the correct number of rows are shown (excluding header)
    const bodyRows = screen.getAllByRole('row').filter(row => 
      row.getAttribute('data-testid')?.startsWith(TESTIDS.NURSE_BULK_ROW_PREFIX)
    );
    expect(bodyRows).toHaveLength(activeUsers.length);
  });

  it('renders only Thursday weight group users when weightGroup is "thu"', () => {
    render(<BulkObservationList weightGroup="thu" />);

    // Get users that are active and in Thursday weight group
    const thursdayUsers = NURSE_USERS.filter(
      (user) => user.isActive !== false && user.weightGroup === 'thu'
    );
    
    // Check that only Thursday users are displayed
    thursdayUsers.forEach((user) => {
      expect(screen.getByTestId(`${TESTIDS.NURSE_BULK_ROW_PREFIX}-${user.id}`)).toBeInTheDocument();
      expect(screen.getByText(user.id)).toBeInTheDocument();
      if (user.name) {
        expect(screen.getByText(user.name)).toBeInTheDocument();
      }
    });

    // Check that Friday users are not displayed
    const fridayUsers = NURSE_USERS.filter(
      (user) => user.isActive !== false && user.weightGroup === 'fri'
    );
    fridayUsers.forEach((user) => {
      expect(screen.queryByTestId(`${TESTIDS.NURSE_BULK_ROW_PREFIX}-${user.id}`)).not.toBeInTheDocument();
    });

    // Verify the correct number of rows are shown
    const bodyRows = screen.getAllByRole('row').filter(row => 
      row.getAttribute('data-testid')?.startsWith(TESTIDS.NURSE_BULK_ROW_PREFIX)
    );
    expect(bodyRows).toHaveLength(thursdayUsers.length);
  });

  it('renders only Friday weight group users when weightGroup is "fri"', () => {
    render(<BulkObservationList weightGroup="fri" />);

    // Get users that are active and in Friday weight group
    const fridayUsers = NURSE_USERS.filter(
      (user) => user.isActive !== false && user.weightGroup === 'fri'
    );
    
    // Check that only Friday users are displayed
    fridayUsers.forEach((user) => {
      expect(screen.getByTestId(`${TESTIDS.NURSE_BULK_ROW_PREFIX}-${user.id}`)).toBeInTheDocument();
      expect(screen.getByText(user.id)).toBeInTheDocument();
      if (user.name) {
        expect(screen.getByText(user.name)).toBeInTheDocument();
      }
    });

    // Check that Thursday users are not displayed
    const thursdayUsers = NURSE_USERS.filter(
      (user) => user.isActive !== false && user.weightGroup === 'thu'
    );
    thursdayUsers.forEach((user) => {
      expect(screen.queryByTestId(`${TESTIDS.NURSE_BULK_ROW_PREFIX}-${user.id}`)).not.toBeInTheDocument();
    });

    // Verify the correct number of rows are shown
    const bodyRows = screen.getAllByRole('row').filter(row => 
      row.getAttribute('data-testid')?.startsWith(TESTIDS.NURSE_BULK_ROW_PREFIX)
    );
    expect(bodyRows).toHaveLength(fridayUsers.length);
  });

  it('excludes inactive users from all weight group filters', () => {
    render(<BulkObservationList weightGroup="all" />);

    // Check that inactive users are not displayed
    const inactiveUsers = NURSE_USERS.filter((user) => user.isActive === false);
    inactiveUsers.forEach((user) => {
      expect(screen.queryByTestId(`${TESTIDS.NURSE_BULK_ROW_PREFIX}-${user.id}`)).not.toBeInTheDocument();
    });
  });

  it('renders with default weightGroup prop when not specified', () => {
    render(<BulkObservationList />);

    // Should behave the same as weightGroup="all"
    const activeUsers = NURSE_USERS.filter((user) => user.isActive !== false);
    const bodyRows = screen.getAllByRole('row').filter(row => 
      row.getAttribute('data-testid')?.startsWith(TESTIDS.NURSE_BULK_ROW_PREFIX)
    );
    expect(bodyRows).toHaveLength(activeUsers.length);
  });

  it('verifies weight group filtering logic with specific user data', () => {
    // Test with actual user data to verify filtering works correctly
    const thursdayUsers = NURSE_USERS.filter(
      (user) => user.isActive !== false && user.weightGroup === 'thu'
    );
    const fridayUsers = NURSE_USERS.filter(
      (user) => user.isActive !== false && user.weightGroup === 'fri'
    );
    
    // Ensure we have users in both groups for a meaningful test
    expect(thursdayUsers.length).toBeGreaterThan(0);
    expect(fridayUsers.length).toBeGreaterThan(0);
    
    // Test Thursday filter
    const { rerender } = render(<BulkObservationList weightGroup="thu" />);
    
    thursdayUsers.forEach((user) => {
      expect(screen.getByTestId(`${TESTIDS.NURSE_BULK_ROW_PREFIX}-${user.id}`)).toBeInTheDocument();
    });
    
    fridayUsers.forEach((user) => {
      expect(screen.queryByTestId(`${TESTIDS.NURSE_BULK_ROW_PREFIX}-${user.id}`)).not.toBeInTheDocument();
    });
    
    // Test Friday filter
    rerender(<BulkObservationList weightGroup="fri" />);
    
    fridayUsers.forEach((user) => {
      expect(screen.getByTestId(`${TESTIDS.NURSE_BULK_ROW_PREFIX}-${user.id}`)).toBeInTheDocument();
    });
    
    thursdayUsers.forEach((user) => {
      expect(screen.queryByTestId(`${TESTIDS.NURSE_BULK_ROW_PREFIX}-${user.id}`)).not.toBeInTheDocument();
    });
  });
});