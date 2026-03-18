import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import TodayOpsPage from '../../../src/pages/TodayOpsPage';
import { TodayBentoLayout } from '../../../src/features/today/layouts/TodayBentoLayout';
import { useTodayActionQueue } from '../../../src/features/today/hooks/useTodayActionQueue';

import type { ActionCard as IActionCard } from '../../../src/features/today/domain/models/queue.types';

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
  useTodaySummary: vi.fn(() => ({})),
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
  useTodayScheduleLanes: vi.fn(() => ({ lanes: { staffLane: [], userLane: [], organizationLane: [] }, isLoading: false })),
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
  useTransportStatus: vi.fn(() => ({ pending: [], inProgress: [], onArrived: vi.fn() })),
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

describe('TodayOpsPage (ActionQueueTimeline integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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
  ];

  it('passes actionQueue and correct click handlers to TodayBentoLayout', () => {
    // Arrange
    vi.mocked(useTodayActionQueue).mockReturnValue({
      actionQueue: dummyActionQueue,
      isLoading: false,
      error: null,
      refresh: vi.fn(),
    });

    // Act
    render(
      <MemoryRouter>
        <TodayOpsPage />
      </MemoryRouter>
    );

    // Assert layout received the queue timeline props
    expect(TodayBentoLayout).toHaveBeenCalled();
    const mockCalls = vi.mocked(TodayBentoLayout).mock.calls;
    const props = mockCalls.length > 0 ? (mockCalls[mockCalls.length - 1]?.[0] as Record<string, unknown>) : {};
    
    expect(props.actionQueueTimeline).toBeDefined();
    
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
  });
});
