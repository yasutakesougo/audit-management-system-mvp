import { act } from '@testing-library/react';
import { renderWithProviders } from '../_helpers/renderWithProviders';
import ExceptionCenterPage from '../../../src/pages/admin/ExceptionCenterPage';
import { ExceptionTable } from '../../../src/features/exceptions/components/ExceptionTable';
import type { ActionSuggestion } from '../../../src/features/action-engine/domain/types';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../src/features/exceptions/hooks/useExceptionDataSources', () => ({
  useExceptionDataSources: vi.fn(() => ({
    status: 'ready',
    expectedUsers: [],
    todayRecords: [],
    today: '2026-03-21',
    criticalHandoffs: [],
    userSummaries: [],
    integrityExceptions: [],
    dataOSResolutions: {},
    error: null,
  })),
}));

const stableId = 'behavior-trend-increase:user-001:2026-W12';

vi.mock('../../../src/features/exceptions/hooks/useCorrectiveActionExceptions', () => ({
  useCorrectiveActionExceptions: vi.fn(() => ({
    items: [
      {
        id: `ae:${stableId}`,
        category: 'corrective-action',
        severity: 'high',
        title: '改善提案',
        description: '根拠',
        targetUserId: 'user-001',
        targetDate: '2026-03-21',
        updatedAt: '2026-03-21T09:00:00Z',
        actionPath: '/assessment',
        actionLabel: '確認',
        stableId,
      },
    ],
    count: 1,
  })),
}));

vi.mock('../../../src/features/exceptions/hooks/useHandoffExceptions', () => ({
  useHandoffExceptions: vi.fn(() => ({
    items: [],
    count: 0,
  })),
}));

vi.mock('../../../src/features/exceptions/hooks/useDailyRecordExceptions', () => ({
  useDailyRecordExceptions: vi.fn(() => ({
    items: [],
    count: 0,
  })),
}));

vi.mock('../../../src/features/exceptions/hooks/useTransportExceptions', () => ({
  useTransportExceptions: vi.fn(() => ({
    items: [],
    status: 'ready',
  })),
}));

vi.mock('../../../src/features/exceptions/components/ExceptionTable', () => ({
  ExceptionTable: vi.fn(() => <div data-testid="exception-table" />),
}));

const mockDismissSuggestion = vi.fn();
const mockSnoozeSuggestion = vi.fn();
vi.mock('../../../src/features/action-engine/hooks/useSuggestionStateStore', () => ({
  useSuggestionStateStore: (
    selector: (state: {
      states: Record<string, unknown>;
      dismiss: (...args: unknown[]) => void;
      snooze: (...args: unknown[]) => void;
    }) => unknown,
  ) => selector({
    states: {},
    dismiss: (...args: unknown[]) => mockDismissSuggestion(...args),
    snooze: (...args: unknown[]) => mockSnoozeSuggestion(...args),
  }),
}));

// useAllCorrectiveActions mock — suggestion データの注入
let mockAllSuggestions: ActionSuggestion[] = [];
vi.mock('../../../src/features/action-engine/hooks/useAllCorrectiveActions', () => ({
  useAllCorrectiveActions: vi.fn(() => ({
    suggestions: mockAllSuggestions,
    status: 'ready',
    error: null,
    count: mockAllSuggestions.length,
  })),
}));

const mockRecordSuggestionTelemetry = vi.fn();
vi.mock('../../../src/features/action-engine/telemetry/recordSuggestionTelemetry', () => ({
  recordSuggestionTelemetry: (...args: unknown[]) => mockRecordSuggestionTelemetry(...args),
}));

describe('ExceptionCenterPage suggestion telemetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-21T10:00:00Z'));
    vi.clearAllMocks();
    mockAllSuggestions = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ExceptionTable からの CTA/dismiss/snooze callback で telemetry を送る', async () => {
    const suggestion: ActionSuggestion = {
      id: 's1',
      stableId,
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

    // useAllCorrectiveActions を通じてデータを注入
    mockAllSuggestions = [suggestion];

    renderWithProviders(
      <ExceptionCenterPage />,
    );

    expect(ExceptionTable).toHaveBeenCalled();
    const calls = vi.mocked(ExceptionTable).mock.calls;
    const props = calls.length > 0 ? (calls[calls.length - 1]?.[0] as Record<string, unknown>) : {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actions = (props.suggestionActions as any);

    await act(async () => {
      actions.onCtaClick(stableId, '/assessment', 'table');
      actions.onDismiss(stableId);
      actions.onSnooze(stableId, 'three-days');
    });

    expect(mockRecordSuggestionTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'suggestion_cta_clicked',
        sourceScreen: 'exception-center',
        stableId,
        targetUrl: '/assessment',
        ctaSurface: 'table',
      }),
    );
    expect(mockRecordSuggestionTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'suggestion_dismissed',
        sourceScreen: 'exception-center',
        stableId,
      }),
    );
    expect(mockRecordSuggestionTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'suggestion_snoozed',
        sourceScreen: 'exception-center',
        stableId,
        snoozePreset: 'three-days',
      }),
    );

    expect(mockDismissSuggestion).toHaveBeenCalledWith(stableId, { by: 'exception-center' });
    expect(mockSnoozeSuggestion).toHaveBeenCalledWith(
      stableId,
      expect.any(String),
      { by: 'exception-center' },
    );
  });
});
