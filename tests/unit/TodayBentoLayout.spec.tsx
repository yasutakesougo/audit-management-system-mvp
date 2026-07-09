import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TodayBentoLayout, type TodayBentoProps } from '../../src/features/today/layouts/TodayBentoLayout';
import type { TodayTask } from '../../src/domain/todayEngine';

let layoutMode: 'standard' | 'kiosk' = 'standard';

vi.mock('../../src/features/settings/SettingsContext', () => ({
  useSettingsContext: () => ({
    settings: { layoutMode },
  }),
}));

vi.mock('../../src/features/today/components/HeroActionCard', () => ({
  HeroActionCard: () => <div data-testid="hero-action-card" />,
}));

vi.mock('../../src/features/today/widgets/ProgressStatusBar', () => ({
  ProgressStatusBar: () => <div data-testid="progress-status-bar" />,
}));

vi.mock('../../src/features/today/widgets/AttendanceSummaryCard', () => ({
  AttendanceSummaryCard: () => <div data-testid="attendance-summary-card" />,
}));

vi.mock('../../src/features/today/widgets/UserCompactList', () => ({
  UserCompactList: () => <div data-testid="user-compact-list" />,
}));

vi.mock('../../src/features/today/components/TodayExceptionAlerts', () => ({
  TodayExceptionAlerts: () => <div data-testid="today-exception-alerts" />,
}));

vi.mock('../../src/features/today/components/KioskStatusBar', () => ({
  KioskStatusBar: () => <div data-testid="kiosk-status-bar" />,
}));

vi.mock('../../src/features/today/components/KioskHeroBlock', () => ({
  KioskHeroBlock: () => <div data-testid="kiosk-hero-block" />,
}));

const task = (overrides: Partial<TodayTask> = {}): TodayTask => ({
  id: 'task-1',
  userId: 'user-1',
  label: '未入力記録があります',
  source: 'unrecorded',
  priority: 100,
  actionType: 'quickRecord',
  completed: false,
  ...overrides,
});

const baseProps = (): TodayBentoProps => ({
  progress: {
    summary: {
      totalRecordCount: 1,
      pendingRecordCount: 1,
      completedRecordCount: 0,
      handoffCount: 0,
      criticalHandoffCount: 0,
      taskCount: 1,
      completedTaskCount: 0,
    },
  },
  attendance: {
    facilityAttendees: 1,
    scheduledCount: 1,
    presentCount: 1,
    absentCount: 0,
    pendingCount: 0,
  },
  briefingAlerts: [],
  nextAction: {},
  userListProps: {
    users: [],
    visits: {},
    onUserClick: vi.fn(),
  },
  visits: {},
  transport: {
    pending: [],
    inProgress: [],
    onArrived: vi.fn(),
  },
});

describe('TodayBentoLayout action queue integration', () => {
  it('renders ActionQueueCard directly below the hero area when actionQueue props are provided', () => {
    layoutMode = 'standard';

    render(
      <TodayBentoLayout
        {...baseProps()}
        actionQueue={{
          tasks: [task(), task({ id: 'task-2', source: 'handoff' })],
          onNavigate: vi.fn(),
        }}
      />,
    );

    expect(screen.getByTestId('bento-action-queue')).toBeInTheDocument();
    expect(screen.getByTestId('action-queue-card')).toBeInTheDocument();
    expect(screen.getByText('残り 2 件')).toBeInTheDocument();
  });

  it('does not render the standard ActionQueueCard in kiosk layout', () => {
    layoutMode = 'kiosk';

    render(
      <TodayBentoLayout
        {...baseProps()}
        actionQueue={{
          tasks: [task()],
          onNavigate: vi.fn(),
        }}
      />,
    );

    expect(screen.queryByTestId('bento-action-queue')).not.toBeInTheDocument();
    expect(screen.queryByTestId('action-queue-card')).not.toBeInTheDocument();
  });
});
