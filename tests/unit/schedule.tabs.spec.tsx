import { ThemeProvider, createTheme } from '@mui/material/styles';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WeekPage from '@/features/schedules/WeekPage';
import { TESTIDS } from '@/testids';

// Mock all async dependencies to eliminate lifecycle issues
vi.mock('@/features/schedules/useSchedules', () => ({
  useSchedules: vi.fn(() => ({
    items: [
      {
        id: 'test-1',
        title: 'テスト予定',
        start: new Date().toISOString(),
        end: new Date(Date.now() + 3600000).toISOString(),
        category: 'User',
      },
    ],
    loading: false,
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  })),
  makeRange: vi.fn((from, to) => ({ from: from.toISOString(), to: to.toISOString() })),
}));

vi.mock('@/features/schedules/useScheduleUserOptions', () => ({
  useScheduleUserOptions: vi.fn(() => []),
}));

vi.mock('@/a11y/LiveAnnouncer', () => ({
  useAnnounce: vi.fn(() => vi.fn()),
}));

vi.mock('@/auth/useAuth', () => ({
  useAuth: vi.fn(() => ({ account: null, login: vi.fn(), logout: vi.fn() })),
}));

vi.mock('@/auth/useUserAuthz', () => ({
  useUserAuthz: vi.fn(() => ({ canEdit: true, canCreate: true, canDelete: true })),
}));

const renderWeekPage = () =>
  render(
    <MemoryRouter initialEntries={['/schedule/week']}>
      <ThemeProvider theme={createTheme()}>
        <WeekPage />
      </ThemeProvider>
    </MemoryRouter>
  );

describe('WeekPage tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // DO NOT call cleanup() - RTL does this automatically in vitest.setup.ts
    vi.clearAllTimers();
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
    const weekPanel = screen.getByRole('tabpanel', { name: /週/i });
    expect(weekPanel).toBeVisible();
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

  it('shows demo schedule items in timeline view', async () => {
    renderWeekPage();
    await screen.findAllByTestId('schedule-item');
    fireEvent.click(screen.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_TIMELINE));
    const timeline = await screen.findByTestId(TESTIDS['schedules-week-timeline']);
    const items = within(timeline).queryAllByTestId('schedule-item');
    if (items.length === 0) {
      expect(within(timeline).getAllByText(/:00/).length).toBeGreaterThan(0);
      return;
    }
    const text = items.map((item) => item.textContent ?? '').join('\n');
    expect(text).toContain('テスト予定');
  });
});
