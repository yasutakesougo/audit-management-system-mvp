import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../src/hooks/useToast';
import { SettingsProvider } from '../../../src/features/settings';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '../../../src/features/settings/settingsModel';
import TodayOpsPage from '../../../src/pages/today-isolated/TodayOpsPage_v3';
import { TodayBentoLayout } from '../../../src/features/today/layouts/TodayBentoLayout';
import { useTodayActionQueue } from '../../../src/features/today/hooks/useTodayActionQueue';
import { TodayLitePage } from '../../../src/features/today/lightweight/TodayLitePage';

import type { ActionCard as IActionCard } from '../../../src/features/today/domain/models/queue.types';
import type { ActionSuggestion } from '../../../src/features/action-engine/domain/types';

let mockTodayLiteUiFlag = false;
let mockAuthzRole: 'viewer' | 'reception' | 'admin' = 'reception';
vi.mock('../../../src/config/featureFlags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/config/featureFlags')>();
  return {
    ...actual,
    useFeatureFlag: (flag: string) => {
      if (flag === 'todayLiteUi') return mockTodayLiteUiFlag;
      return false;
    },
  };
});

vi.mock('../../../src/features/today/lightweight/TodayLitePage', () => ({
  TodayLitePage: vi.fn(() => <div data-testid="today-lite-page" />),
}));

vi.mock('../../../src/auth/useUserAuthz', () => ({
  useUserAuthz: vi.fn(() => ({
    role: mockAuthzRole,
    ready: true,
  })),
}));

// Mocks for all the dependencies the page relies on
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/today', search: '' }),
  };
});

vi.mock('../../../src/features/auth/store', () => ({
  useAuthStore: vi.fn(() => 'staff'),
}));

vi.mock('../../../src/features/today/domain', () => ({
  useTodaySummary: vi.fn(() => ({
    todayExceptionActions: [],
    todayExceptions: [],
  })),
}));

vi.mock('../../../src/features/today/hooks/useApprovalFlow', () => ({
  useApprovalFlow: vi.fn(() => ({ isOpen: false, close: vi.fn() })),
}));

vi.mock('../../../src/features/today/hooks/useNextAction', () => ({
  useNextAction: vi.fn(() => ({})),
}));

vi.mock('../../../src/features/today/hooks/useSceneNextAction', () => ({
  useSceneNextAction: vi.fn(() => ({})),
}));

vi.mock('../../../src/features/today/hooks/useTodayScheduleLanes', () => ({
  useTodayScheduleLanes: vi.fn(() => ({
    lanes: { staffLane: [], userLane: [], organizationLane: [] },
    isLoading: false,
    source: 'demo',
    error: null,
    refetch: vi.fn(),
  })),
}));

vi.mock('../../../src/features/today/hooks/useWorkflowPhases', () => ({
  useWorkflowPhases: vi.fn(() => ({ items: [], counts: {}, topPriorityItem: null, isLoading: false })),
}));

vi.mock('../../../src/features/today/hooks/useTodayLayoutProps', () => ({
  useTodayLayoutProps: vi.fn(() => ({})), // Minimal mock
}));

vi.mock('../../../src/features/today/layouts/TodayBentoLayout', () => ({
  TodayBentoLayout: vi.fn(() => <div data-testid="bento-layout" />)
}));

vi.mock('../../../src/features/planning-sheet/hooks/usePlanningSheetRepositories', () => ({
  usePlanningSheetRepositories: vi.fn(() => ({})),
}));

vi.mock('../../../src/features/today/transport', () => ({
  useTransportStatus: vi.fn(() => ({
    pending: [],
    inProgress: [],
    onArrived: vi.fn(),
    refresh: vi.fn(async () => {}),
  })),
  useTransportHighlight: vi.fn(() => ({ highlightStyle: {}, clearHighlight: vi.fn() })),
}));

const mockOpenUnfilled = vi.fn();
vi.mock('../../../src/features/today/records/useQuickRecord', () => ({
  useQuickRecord: vi.fn(() => ({
    isOpen: false,
    mode: 'test',
    userId: 'user-1',
    close: vi.fn(),
    autoNextEnabled: false,
    setAutoNextEnabled: vi.fn(),
    openUnfilled: mockOpenUnfilled,
  })),
}));

vi.mock('../../../src/features/today/hooks/useTodayActionQueue', () => ({
  useTodayActionQueue: vi.fn(),
}));

const mockRecordSuggestionTelemetry = vi.fn();
vi.mock('../../../src/features/action-engine/telemetry/recordSuggestionTelemetry', () => ({
  recordSuggestionTelemetry: (...args: unknown[]) => mockRecordSuggestionTelemetry(...args),
}));

const mockRecordKioskTelemetry = vi.fn();
vi.mock('../../../src/features/today/telemetry/recordKioskTelemetry', () => ({
  recordKioskTelemetry: (...args: unknown[]) => mockRecordKioskTelemetry(...args),
}));

const mockDismissSuggestion = vi.fn();
const mockSnoozeSuggestion = vi.fn();
vi.mock('../../../src/features/action-engine/hooks/useSuggestionStateStore', () => ({
  useSuggestionStateStore: vi.fn((selector: (state: {
    states: Record<string, unknown>;
    dismiss: typeof mockDismissSuggestion;
    snooze: typeof mockSnoozeSuggestion;
  }) => unknown) => selector({
    states: {},
    dismiss: mockDismissSuggestion,
    snooze: mockSnoozeSuggestion,
  })),
}));

vi.mock('../../../src/features/today/hooks/useUserAlerts', () => ({
  useUserAlerts: vi.fn(() => ({ alertsByUser: {} })),
}));

vi.mock('../../../src/features/today/hooks/useTodayExceptions', () => ({
  useTodayExceptions: vi.fn(() => ({
    items: [],
    isLoading: false,
    refetchDailyRecords: vi.fn(),
    heroItem: null,
    queueItems: [],
    error: null,
  })),
}));

vi.mock('../../../src/features/today/hooks/useWeeklyHighLoadStatus', () => ({
  useWeeklyHighLoadStatus: vi.fn(() => ({ visible: false })),
}));

vi.mock('../../../src/features/callLogs/hooks/useCallLogsSummary', () => ({
  useCallLogsSummary: vi.fn(() => ({
    openCount: 0,
    urgentCount: 0,
    callbackPendingCount: 0,
    myOpenCount: 0,
    overdueCount: 0,
    isLoading: false,
    refresh: vi.fn(async () => {}),
  })),
}));

vi.mock('../../../src/auth/useAuth', () => ({
  useAuth: vi.fn(() => ({ account: { name: 'Test User' } })),
}));

vi.mock('../../../src/features/schedules/hooks/useUserStatusActions', () => ({
  useUserStatusActions: vi.fn(() => ({
    todayStatusRecords: {},
  })),
}));

vi.mock('../../../src/features/today/records/QuickRecordDrawer', () => ({
  QuickRecordDrawer: vi.fn(() => null),
}));

vi.mock('../../../src/features/callLogs/components/CallLogQuickDrawer', () => ({
  CallLogQuickDrawer: vi.fn(() => null),
}));

vi.mock('../../../src/features/handoff/components', () => ({
  HandoffPanel: vi.fn(() => null),
}));

vi.mock('../../../src/features/today/widgets/ApprovalDialog', () => ({
  ApprovalDialog: vi.fn(() => null),
}));

vi.mock('../../../src/features/schedules/components/UserStatusQuickDialog', () => ({
  UserStatusQuickDialog: vi.fn(() => null),
}));

describe('TodayOpsPage (ActionQueueTimeline integration)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T10:00:00Z'));
    vi.clearAllMocks();
    mockTodayLiteUiFlag = false;
    mockAuthzRole = 'reception';
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const correctiveSuggestion: ActionSuggestion = {
    id: 's1',
    stableId: 'behavior-trend-increase:user-001:2026-W12',
    type: 'assessment_update',
    priority: 'P1',
    targetUserId: 'user-001',
    title: '改善提案',
    reason: '理由',
    evidence: {
      metric: 'm',
      currentValue: 1,
      threshold: 2,
      period: '7d',
    },
    cta: {
      label: '確認',
      route: '/assessment',
    },
    createdAt: '2026-03-21T09:00:00Z',
    ruleId: 'behavior-trend-increase',
  };

  const dummyActionQueue: IActionCard[] = [
    {
      id: 'act-nav',
      title: 'Navigation Test',
      priority: 'P1',
      contextMessage: 'msg',
      actionType: 'NAVIGATE',
      requiresAttention: false,
      isOverdue: false,
      payload: { path: '/test-route' },
    },
    {
      id: 'act-drawer',
      title: 'Drawer Test',
      priority: 'P2',
      contextMessage: 'msg',
      actionType: 'OPEN_DRAWER',
      requiresAttention: false,
      isOverdue: false,
      payload: null,
    },
    {
      id: 'act-ack',
      title: 'Acknowledge Test',
      priority: 'P3',
      contextMessage: 'msg',
      actionType: 'ACKNOWLEDGE',
      requiresAttention: false,
      isOverdue: false,
      payload: null,
    },
    {
      id: `corrective:${correctiveSuggestion.stableId}`,
      title: 'Corrective Test',
      priority: 'P1',
      contextMessage: 'msg',
      actionType: 'NAVIGATE',
      requiresAttention: true,
      isOverdue: false,
      payload: { suggestion: correctiveSuggestion },
    },
  ];

  it('renders lightweight UI when todayLiteUi flag is ON', () => {
    mockTodayLiteUiFlag = true;

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <SettingsProvider>
            <MemoryRouter>
              <TodayOpsPage correctiveActions={[]} />
            </MemoryRouter>
          </SettingsProvider>
        </ToastProvider>
      </QueryClientProvider>
    );

    expect(screen.getByTestId('today-lite-page')).toBeInTheDocument();
    expect(TodayBentoLayout).not.toHaveBeenCalled();
    const liteCalls = vi.mocked(TodayLitePage).mock.calls;
    const liteProps = liteCalls[liteCalls.length - 1]?.[0] as { role?: string };
    expect(liteProps.role).toBe('staff');
  });

  it('passes admin role to lightweight UI when authz role is admin', () => {
    mockTodayLiteUiFlag = true;
    mockAuthzRole = 'admin';

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <SettingsProvider>
            <MemoryRouter>
              <TodayOpsPage correctiveActions={[]} />
            </MemoryRouter>
          </SettingsProvider>
        </ToastProvider>
      </QueryClientProvider>
    );

    const liteCalls = vi.mocked(TodayLitePage).mock.calls;
    const liteProps = liteCalls[liteCalls.length - 1]?.[0] as { role?: string };
    expect(liteProps.role).toBe('admin');
  });

  it('passes actionQueue and correct click handlers to TodayBentoLayout', () => {
    // Arrange
    vi.mocked(useTodayActionQueue).mockReturnValue({
      actionQueue: dummyActionQueue,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    });

    // Act
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <SettingsProvider>
            <MemoryRouter>
              <TodayOpsPage correctiveActions={[correctiveSuggestion]} />
            </MemoryRouter>
          </SettingsProvider>
        </ToastProvider>
      </QueryClientProvider>
    );

    // Assert layout received the queue timeline props
    expect(TodayBentoLayout).toHaveBeenCalled();
    const mockCalls = vi.mocked(TodayBentoLayout).mock.calls;
    const props = mockCalls.length > 0 ? (mockCalls[mockCalls.length - 1]?.[0] as Record<string, unknown>) : {};
    
    expect(props.actionQueueTimeline).toBeDefined();
    expect(props.audience).toBe('reception');
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const timelineProps = props.actionQueueTimeline as any;
    expect(timelineProps.actionQueue).toEqual(dummyActionQueue);
    expect(timelineProps.isLoading).toBe(false);

    // Act + Assert routing logic (NAVIGATE)
    timelineProps.onActionClick(dummyActionQueue[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/test-route');

    // Act + Assert drawer logic (OPEN_DRAWER)
    timelineProps.onActionClick(dummyActionQueue[1]);
    expect(mockOpenUnfilled).toHaveBeenCalled();

    // Act + Assert no-op logic (ACKNOWLEDGE)
    const prevNavCount = mockNavigate.mock.calls.length;
    const prevOpenCount = mockOpenUnfilled.mock.calls.length;
    timelineProps.onActionClick(dummyActionQueue[2]);
    // Nav and Drawer should NOT be triggered
    expect(mockNavigate).toHaveBeenCalledTimes(prevNavCount);
    expect(mockOpenUnfilled).toHaveBeenCalledTimes(prevOpenCount);

    // Corrective CTA click emits telemetry and navigates to suggestion route
    timelineProps.onActionClick(dummyActionQueue[3]);
    expect(mockNavigate).toHaveBeenCalledWith('/assessment');
    expect(mockRecordSuggestionTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'suggestion_cta_clicked',
        sourceScreen: 'today',
        stableId: correctiveSuggestion.stableId,
      }),
    );

    // Dismiss / Snooze emits telemetry from shared callback
    timelineProps.onDismissSuggestion(correctiveSuggestion.stableId);
    timelineProps.onSnoozeSuggestion(correctiveSuggestion.stableId, 'tomorrow');

    expect(mockRecordSuggestionTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'suggestion_dismissed',
        sourceScreen: 'today',
        stableId: correctiveSuggestion.stableId,
      }),
    );
    expect(mockRecordSuggestionTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'suggestion_snoozed',
        sourceScreen: 'today',
        stableId: correctiveSuggestion.stableId,
        snoozePreset: 'tomorrow',
      }),
    );
  });

  it('passes viewer audience to legacy Today layout when authz role is viewer', () => {
    mockAuthzRole = 'viewer';
    vi.mocked(useTodayActionQueue).mockReturnValue({
      actionQueue: [],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <SettingsProvider>
            <MemoryRouter>
              <TodayOpsPage correctiveActions={[]} />
            </MemoryRouter>
          </SettingsProvider>
        </ToastProvider>
      </QueryClientProvider>
    );

    const mockCalls = vi.mocked(TodayBentoLayout).mock.calls;
    const props = mockCalls.length > 0 ? (mockCalls[mockCalls.length - 1]?.[0] as Record<string, unknown>) : {};
    expect(props.audience).toBe('viewer');
  });

  it('passes admin audience to legacy Today layout when authz role is admin', () => {
    mockAuthzRole = 'admin';
    vi.mocked(useTodayActionQueue).mockReturnValue({
      actionQueue: [],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <SettingsProvider>
            <MemoryRouter>
              <TodayOpsPage correctiveActions={[]} />
            </MemoryRouter>
          </SettingsProvider>
        </ToastProvider>
      </QueryClientProvider>
    );

    const mockCalls = vi.mocked(TodayBentoLayout).mock.calls;
    const props = mockCalls.length > 0 ? (mockCalls[mockCalls.length - 1]?.[0] as Record<string, unknown>) : {};
    expect(props.audience).toBe('admin');
  });

  it('records kiosk session start telemetry when /today is opened in kiosk mode', async () => {
    vi.useRealTimers();
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        layoutMode: 'kiosk',
      }),
    );

    vi.mocked(useTodayActionQueue).mockReturnValue({
      actionQueue: [],
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    });

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <SettingsProvider>
            <MemoryRouter>
              <TodayOpsPage correctiveActions={[]} />
            </MemoryRouter>
          </SettingsProvider>
        </ToastProvider>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(mockRecordKioskTelemetry).toHaveBeenCalledWith(
        'ux_kiosk_session_started',
        expect.objectContaining({
          mode: 'kiosk',
          source: 'today',
        }),
      );
    });
  });
});
