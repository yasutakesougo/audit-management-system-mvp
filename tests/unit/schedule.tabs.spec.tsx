import { ThemeProvider, createTheme } from '@mui/material/styles';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import WeekPage from '@/features/schedules/routes/WeekPage';
import { TESTIDS } from '@/testids';

// ── Mock: Layout Context ────────────────────────────────────────────────────
vi.mock('@/app/LayoutContext', () => ({
  useBreakpointFlags: () => ({ isDesktopSize: false, isTabletSize: false }),
  useOrientation: () => ({ isLandscape: false }),
}));

// ── Mock: Auth ──────────────────────────────────────────────────────────────
vi.mock('@/auth/useAuth', () => ({
  useAuth: () => ({ account: { username: 'test@example.com' }, login: vi.fn(), logout: vi.fn() }),
}));

vi.mock('@/auth/useUserAuthz', () => ({
  useUserAuthz: () => ({ role: 'admin', canEdit: true, canCreate: true, canDelete: true, ready: true }),
}));

vi.mock('@/auth/roles', () => ({
  canAccess: () => true,
}));

// ── Mock: useScheduleUserOptions ────────────────────────────────────────────
vi.mock('@/features/schedules/hooks/useScheduleUserOptions', () => ({
  useScheduleUserOptions: () => [],
}));

// ── Mock: useSchedulesPageState (orchestrator) ──────────────────────────────
const mockPageState = {
  route: {
    mode: 'week',
    focusDate: new Date('2026-01-26T00:00:00'),
    dialogIntent: null,
    filter: { category: 'All', query: '' },
    setFilter: vi.fn(),
  },
  mode: 'week',
  categoryFilter: 'All',
  query: '',
  canEdit: true,
  canEditByRole: true,
  myUpn: 'test@example.com',
  ready: true,
  focusDate: new Date('2026-01-26T00:00:00'),
  weekRange: { from: '2026-01-26T00:00:00.000Z', to: '2026-02-02T00:00:00.000Z' },
  monthRange: { from: '2026-01-01T00:00:00.000Z', to: '2026-02-12T00:00:00.000Z' },
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
  isLoading: false,
  filteredItems: [
    {
      id: 'test-1',
      title: 'テスト予定',
      start: '2026-01-26T10:00:00.000Z',
      end: '2026-01-26T11:00:00.000Z',
      category: 'User',
      serviceType: 'HomeVisit',
    },
  ],
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  lastError: null,
  clearLastError: vi.fn(),
  refetch: vi.fn(),
  readOnlyReason: undefined,
  canWrite: true,
  dialogIntent: null,
  dialogMode: 'create',
  dialogEventId: null,
  createDialogOpen: false,
  scheduleDialogModeProps: { mode: 'create' as const, initialOverride: undefined },
  createDialogInitialDate: undefined,
  createDialogInitialStartTime: undefined,
  createDialogInitialEndTime: undefined,
  weekLabel: '1/26 〜 2/1',
  weekAnnouncement: '2026年1月26日〜2月1日の週を表示',
};

vi.mock('@/features/schedules/hooks/useSchedulesPageState', () => ({
  useSchedulesPageState: () => mockPageState,
}));

// ── Mock: useWeekPageOrchestrator ───────────────────────────────────────────
vi.mock('@/features/schedules/hooks/useWeekPageOrchestrator', () => ({
  useWeekPageOrchestrator: () => ({
    viewItem: null,
    setViewItem: vi.fn(),
    dialogOpen: false,
    dialogInitialValues: null,
    resolvedActiveDateIso: '2026-01-26',
    dayViewHref: '/schedule/day',
    weekViewHref: '/schedule/week',
    monthViewHref: '/schedule/month',
    activeDayRange: null,
    fabRef: { current: null },
    handleDayClick: vi.fn(),
    handleFabClick: vi.fn(),
    handleTimeSlotClick: vi.fn(),
    handleOrgChange: vi.fn(),
    handleViewClick: vi.fn(),
    handleViewEdit: vi.fn(),
    handleViewDelete: vi.fn(),
    handleInlineDialogClose: vi.fn(),
    handleInlineDialogSubmit: vi.fn(),
    handleInlineDialogDelete: vi.fn(),
    handleScheduleDialogSubmit: vi.fn(),
    handleCreateDialogClose: vi.fn(),
    handleConflictDiscard: vi.fn(),
    handleConflictReload: vi.fn(),
    handlePrevWeek: vi.fn(),
    handleNextWeek: vi.fn(),
    handleTodayWeek: vi.fn(),
    handlePrevMonth: vi.fn(),
    handleNextMonth: vi.fn(),
    handleTodayMonth: vi.fn(),
    suppressRouteDialog: false,
    conflictOpen: false,
    orgParam: null,
  }),
}));

// ── Mock: useWeekPageUiState ────────────────────────────────────────────────
vi.mock('@/features/schedules/hooks/useWeekPageUiState', () => ({
  useWeekPageUiState: () => ({
    snack: { open: false, severity: 'success', message: '' },
    setSnack: vi.fn(),
    isInlineSaving: false,
    isInlineDeleting: false,
    conflictDetailOpen: false,
    setConflictDetailOpen: vi.fn(),
    lastErrorAt: null,
    conflictBusy: false,
    highlightId: null,
    setFocusScheduleId: vi.fn(),
  }),
}));

// ── Mock: LiveAnnouncer ─────────────────────────────────────────────────────
vi.mock('@/a11y/LiveAnnouncer', () => ({
  useAnnounce: () => vi.fn(),
}));

// ── Mock: env ───────────────────────────────────────────────────────────────
vi.mock('@/env', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/env')>()),
  isE2eForceSchedulesWrite: false,
}));

// ── Mock: scheduleTz ────────────────────────────────────────────────────────
vi.mock('@/utils/scheduleTz', () => ({
  resolveSchedulesTz: () => 'Asia/Tokyo',
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
  it('renders week page with schedules-week-page test id', async () => {
    renderWeekPage();

    await waitFor(() => {
      expect(screen.getByTestId('schedules-week-page')).toBeInTheDocument();
    });
  });

  it('renders the schedule header', async () => {
    renderWeekPage();

    await waitFor(() => {
      expect(screen.getByTestId('schedules-week-page')).toBeInTheDocument();
    });

    // Header should render with mode tabs
    expect(screen.getByTestId(TESTIDS.SCHEDULES_WEEK_TAB_WEEK)).toBeInTheDocument();
  });

  it('renders navigation controls (prev/next)', async () => {
    renderWeekPage();

    await waitFor(() => {
      expect(screen.getByTestId('schedules-week-page')).toBeInTheDocument();
    });

    expect(screen.getByTestId(TESTIDS.SCHEDULES_PREV_WEEK)).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.SCHEDULES_NEXT_WEEK)).toBeInTheDocument();
  });
});
