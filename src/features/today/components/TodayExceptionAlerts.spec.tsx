import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { TodayExceptionAction } from '@/features/exceptions/domain/buildTodayExceptions';
import type { UseTodayExceptionsResult } from '../hooks/useTodayExceptions';
import { TodayExceptionAlerts } from './TodayExceptionAlerts';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const snoozeMock = vi.fn();
const dismissMock = vi.fn();

vi.mock('@/features/exceptions/hooks/useExceptionPreferences', () => ({
  useExceptionPreferences: () => ({
    snooze: snoozeMock,
    dismiss: dismissMock,
  }),
}));

function makeItem(id: string, overrides: Partial<TodayExceptionAction> = {}): TodayExceptionAction {
  return {
    id,
    sourceExceptionId: `source-${id}`,
    kind: 'attention-user',
    priority: 'high',
    title: `例外 ${id}`,
    description: `説明 ${id}`,
    actionLabel: '確認',
    actionPath: `/exceptions/${id}`,
    ...overrides,
  };
}

function makeQueue(overrides: Partial<UseTodayExceptionsResult>): UseTodayExceptionsResult {
  const itemA = makeItem('item-a');
  const itemB = makeItem('item-b');
  return {
    items: [itemA, itemB],
    topPriorityItem: itemA,
    heroItem: null,
    queueItems: [itemA, itemB],
    isLoading: false,
    error: null,
    refetchDailyRecords: vi.fn(),
    ...overrides,
  };
}

describe('TodayExceptionAlerts', () => {
  it('司令塔優先チップをクリックすると ExceptionCenter deep link へ遷移する', () => {
    const queue = makeQueue({
      queueItems: [makeItem('item-a', { kind: 'attention-user', userId: 'U-001' })],
      topPriorityItem: makeItem('item-a', { kind: 'attention-user', userId: 'U-001' }),
    });

    render(
      <MemoryRouter>
        <TodayExceptionAlerts exceptionsQueue={queue} audience="admin" />
      </MemoryRouter>,
    );

    screen.getByTestId('today-exception-priority-chip-item-a').click();
    expect(navigateMock).toHaveBeenCalledWith(
      '/admin/exception-center?category=attention-user&userId=U-001&source=today',
    );
  });

  it('topPriorityItem があるときは先頭行に司令塔優先チップを表示する', () => {
    const queue = makeQueue({});

    render(
      <MemoryRouter>
        <TodayExceptionAlerts exceptionsQueue={queue} audience="admin" />
      </MemoryRouter>,
    );

    const alerts = screen.getAllByTestId(/today-exception-alert-/);
    expect(alerts.map((el) => el.getAttribute('data-testid'))).toEqual([
      'today-exception-alert-item-a',
      'today-exception-alert-item-b',
    ]);
    expect(within(alerts[0]!).getByText('司令塔優先')).toBeInTheDocument();
    expect(within(alerts[1]!).queryByText('司令塔優先')).not.toBeInTheDocument();
  });

  it('topPriorityItem が null のときは司令塔優先チップを表示しない', () => {
    const queue = makeQueue({ topPriorityItem: null });

    render(
      <MemoryRouter>
        <TodayExceptionAlerts exceptionsQueue={queue} audience="admin" />
      </MemoryRouter>,
    );

    expect(screen.queryByText('司令塔優先')).not.toBeInTheDocument();
  });

  it('topPriorityItem が heroItem の場合は要確認リストの並びを崩さない', () => {
    const hero = makeItem('hero-critical', {
      priority: 'critical',
      kind: 'critical-handoff',
    });
    const queue = makeQueue({
      topPriorityItem: hero,
      heroItem: hero,
      queueItems: [makeItem('item-1'), makeItem('item-2')],
    });

    render(
      <MemoryRouter>
        <TodayExceptionAlerts exceptionsQueue={queue} audience="admin" />
      </MemoryRouter>,
    );

    expect(screen.getByText('司令塔からの緊急アクション')).toBeInTheDocument();
    const alerts = screen.getAllByTestId(/today-exception-alert-/);
    expect(alerts.map((el) => el.getAttribute('data-testid'))).toEqual([
      'today-exception-alert-item-1',
      'today-exception-alert-item-2',
    ]);
    expect(screen.queryByText('司令塔優先')).not.toBeInTheDocument();
  });

  it('staff は要約表示になり管理導線の優先チップを出さない', () => {
    const queue = makeQueue({
      queueItems: [makeItem('item-a', { kind: 'attention-user', userId: 'U-001' })],
      topPriorityItem: makeItem('item-a', { kind: 'attention-user', userId: 'U-001' }),
    });

    render(
      <MemoryRouter>
        <TodayExceptionAlerts exceptionsQueue={queue} audience="reception" />
      </MemoryRouter>,
    );

    expect(screen.getByTestId('today-exception-alert-compact-summary')).toBeInTheDocument();
    expect(screen.getByTestId('today-exception-alert-compact-action')).toBeInTheDocument();
    expect(screen.queryByText('司令塔優先')).not.toBeInTheDocument();
    expect(screen.queryByTestId(/today-exception-alert-item-/)).not.toBeInTheDocument();
  });
});
