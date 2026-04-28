import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import type { ReactNode } from 'react';
import type { ActionSuggestion } from '../../domain/types';
import type { SnoozePreset } from '../../domain/computeSnoozeUntil';
import { computeSnoozeUntil } from '../../domain/computeSnoozeUntil';
import {
  SUGGESTION_STATE_STORAGE_KEY,
  useSuggestionStateStore,
} from '../useSuggestionStateStore';
import { useTodayActionQueue } from '@/features/today/hooks/useTodayActionQueue';
import { ActionQueueTimelineWidget } from '@/features/today/widgets/ActionQueueTimelineWidget';
import { useCorrectiveActionExceptions } from '@/features/exceptions/hooks/useCorrectiveActionExceptions';
import { ExceptionTable } from '@/features/exceptions/components/ExceptionTable';

const theme = createTheme();
const STABLE_ID = 'behavior-trend-increase:user-001:2026-W12';
const mockRecordSuggestionTelemetry = vi.fn();

vi.mock('@/features/users/useUsers', () => ({
  useUsers: () => ({
    data: [{ Id: 1, UserID: 'user-001', FullName: 'Test User' }],
    isLoading: false,
  }),
}));

vi.mock('../../telemetry/recordSuggestionTelemetry', () => ({
  recordSuggestionTelemetry: (...args: unknown[]) => mockRecordSuggestionTelemetry(...args),
}));

const suggestionFixture: ActionSuggestion = {
  id: 'trend-increase-user-001-1711000000000',
  stableId: STABLE_ID,
  type: 'assessment_update',
  priority: 'P1',
  targetUserId: 'user-001',
  title: '行動発生が増加傾向です',
  reason: '行動発生件数が前週比 150% 増加しています。',
  evidence: {
    metric: '行動発生件数（日平均）',
    currentValue: '5.0',
    threshold: '前週比 +30%',
    period: '直近7日 vs 前7日',
  },
  cta: {
    label: 'アセスメントを見直す',
    route: '/assessment',
  },
  createdAt: '2026-03-21T09:00:00Z',
  ruleId: 'behavior-trend-increase',
};

function renderWithProviders(ui: ReactNode) {
  return render(
    <ThemeProvider theme={theme}>
      <MemoryRouter>{ui}</MemoryRouter>
    </ThemeProvider>,
  );
}

function TodayExceptionSyncHarness() {
  const states = useSuggestionStateStore((s) => s.states);
  const dismiss = useSuggestionStateStore((s) => s.dismiss);
  const snooze = useSuggestionStateStore((s) => s.snooze);

  const { actionQueue, isLoading } = useTodayActionQueue({
    pollingIntervalMs: 3_600_000,
    correctiveActions: [suggestionFixture],
    suggestionStates: states,
  });
  const { items, count } = useCorrectiveActionExceptions({
    suggestions: [suggestionFixture],
    states,
    pollingIntervalMs: 3_600_000,
  });

  const handleDismiss = (stableId: string) => {
    dismiss(stableId, { by: 'test' });
  };

  const handleSnooze = (stableId: string, preset: SnoozePreset) => {
    const until = computeSnoozeUntil(preset, new Date());
    snooze(stableId, until, { by: 'test' });
  };

  const isCorrectiveVisibleOnToday = actionQueue.some(
    (item) => item.id === `corrective:${STABLE_ID}`,
  );

  return (
    <>
      <div data-testid="exception-count">{count}</div>
      <div data-testid="today-corrective-visible">
        {isCorrectiveVisibleOnToday ? '1' : '0'}
      </div>

      <ActionQueueTimelineWidget
        actionQueue={actionQueue}
        isLoading={isLoading}
        onDismissSuggestion={handleDismiss}
        onSnoozeSuggestion={handleSnooze}
      />

      <ExceptionTable
        items={items}
        title="test"
        showFilters={false}
        suggestionActions={{
          onDismiss: handleDismiss,
          onSnooze: handleSnooze,
        }}
      />
    </>
  );
}

describe('suggestion state sync (Today ↔ ExceptionCenter)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T10:00:00Z'));
    localStorage.removeItem(SUGGESTION_STATE_STORAGE_KEY);
    useSuggestionStateStore.setState({ states: {} });
    mockRecordSuggestionTelemetry.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Today で snooze すると ExceptionCenter でも非表示になる', async () => {
    renderWithProviders(<TodayExceptionSyncHarness />);

    // 初回表示で shown が Today / ExceptionCenter それぞれ1件ずつ送信される
    await act(async () => {
      await Promise.resolve();
    });

    const shownCalls = mockRecordSuggestionTelemetry.mock.calls
      .map((c) => c[0] as { event: string; sourceScreen: string })
      .filter((event) => event.event === 'suggestion_shown');
    expect(shownCalls).toHaveLength(2);

    expect(screen.getByTestId('exception-count').textContent).toBe('1');
    expect(screen.getByTestId('today-corrective-visible').textContent).toBe('1');
    expect(screen.getByTestId(`action-card-corrective:${STABLE_ID}`)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId(`suggestion-menu-button-corrective:${STABLE_ID}`));
    fireEvent.click(screen.getByText('明日まで'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('exception-count').textContent).toBe('0');
    expect(screen.getByTestId('today-corrective-visible').textContent).toBe('0');
  });

  it('ExceptionCenter で dismiss すると Today でも非表示になる', async () => {
    renderWithProviders(<TodayExceptionSyncHarness />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('exception-count').textContent).toBe('1');
    expect(screen.getByTestId('today-corrective-visible').textContent).toBe('1');

    fireEvent.click(screen.getByTestId(`suggestion-menu-button-ae:${STABLE_ID}`));
    fireEvent.click(screen.getByText('対応済みにする'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('exception-count').textContent).toBe('0');
    expect(screen.getByTestId('today-corrective-visible').textContent).toBe('0');
  });

  it('snooze 期限経過後に Today / ExceptionCenter で resurfaced が送信される', async () => {
    renderWithProviders(<TodayExceptionSyncHarness />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('exception-count').textContent).toBe('1');
    mockRecordSuggestionTelemetry.mockClear();

    fireEvent.click(screen.getByTestId(`suggestion-menu-button-corrective:${STABLE_ID}`));
    fireEvent.click(screen.getByText('明日まで'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('exception-count').textContent).toBe('0');

    await act(async () => {
      vi.advanceTimersByTime(25 * 60 * 60 * 1000);
      await Promise.resolve();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('exception-count').textContent).toBe('1');
    expect(screen.getByTestId('today-corrective-visible').textContent).toBe('1');

    const resurfacedCalls = mockRecordSuggestionTelemetry.mock.calls
      .map((c) => c[0] as { event: string; sourceScreen: string })
      .filter((event) => event.event === 'suggestion_resurfaced');
    expect(resurfacedCalls.length).toBeGreaterThanOrEqual(1);
    expect(resurfacedCalls.map((event) => event.sourceScreen)).toEqual(
      expect.arrayContaining(['today']),
    );
  });
});
