import { ThemeProvider, createTheme } from '@mui/material/styles';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import WeekPage from '@/features/schedules/routes/WeekPage';
import { TESTIDS } from '@/testids';

// Mock all dependencies to isolate tab switching logic (unit test best practice)
// CRITICAL: Mocks must be synchronous and stateless to avoid open handles
vi.mock('@/features/schedules/useSchedules', () => ({
  useSchedules: () => ({
    items: [
      {
        id: 'test-1',
        title: 'テスト予定',
        start: '2026-01-26T10:00:00.000Z',
        end: '2026-01-26T11:00:00.000Z',
        category: 'User',
        serviceType: 'HomeVisit',
      },
    ],
    loading: false,
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  }),
  makeRange: (from: Date, to: Date) => ({ from: from.toISOString(), to: to.toISOString() }),
}));

vi.mock('@/features/schedules/useScheduleUserOptions', () => ({
  useScheduleUserOptions: () => [],
}));

vi.mock('@/a11y/LiveAnnouncer', () => ({
  useAnnounce: () => vi.fn(),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({ account: null, login: vi.fn(), logout: vi.fn() }),
}));

vi.mock('@/auth/useUserAuthz', () => ({
  useUserAuthz: () => ({ canEdit: true, canCreate: true, canDelete: true }),
}));

const renderWeekPage = () =>
  render(
    <MemoryRouter initialEntries={['/schedule/week']}>
      <ThemeProvider theme={createTheme()}>
        <WeekPage />
      </ThemeProvider>
    </MemoryRouter>
  );

describe.skip('WeekPage tabs', () => {
  // Fix: Stabilize date to prevent UTC/JST mismatch in selectedItems
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-26T12:00:00.000Z')); // Monday noon UTC
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders week view by default', async () => {
    renderWeekPage();
    
    // Wait for React state updates to complete (prevents act warnings)
    await waitFor(() => {
      expect(screen.getByTestId('schedules-week-page')).toBeInTheDocument();
    });
    
    // Verify week tab is active
    const weekTab = screen.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_WEEK);
    expect(weekTab).toHaveAttribute('aria-selected', 'true');
    
    // Verify week panel is visible (role=tabpanel with correct aria-labelledby)
    const weekView = screen.getByTestId('schedule-week-view');
    expect(weekView).toBeVisible();
  });

  it('shows demo schedule items in week view', async () => {
    renderWeekPage();
    const items = await screen.findAllByTestId('schedule-item');
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('switches to day view when tab clicked', async () => {
    renderWeekPage();
    fireEvent.click(screen.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_DAY));
    const dayPage = await screen.findByTestId(TESTIDS['schedules-day-page']);
    expect(dayPage).toBeInTheDocument();
  });

  it('shows demo schedule items in day view', async () => {
    renderWeekPage();
    await screen.findAllByTestId('schedule-item');
    fireEvent.click(screen.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_DAY));
    const list = await screen.findByTestId(TESTIDS['schedules-day-list']);
    expect(list.textContent).toContain('テスト予定');
  });

  // Timeline view removed; day/week/month are covered by other tests.
});
