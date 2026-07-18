import { act, screen, within } from '@testing-library/react';
import { renderWithProviders } from '../_helpers/renderWithProviders';
import ExceptionCenterPage from '../../../src/pages/admin/ExceptionCenterPage';
import { ExceptionTable } from '../../../src/features/exceptions/components/ExceptionTable';
import type { ActionSuggestion } from '../../../src/features/action-engine/domain/types';
import type { ExceptionItem } from '../../../src/features/exceptions/domain/exceptionLogic';
import { useCorrectiveActionExceptions } from '../../../src/features/exceptions/hooks/useCorrectiveActionExceptions';
import type { EscalatedException } from '../../../src/features/exceptions/hooks/useEscalationEvaluation';

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

const defaultCorrectiveItems: ExceptionItem[] = [
  {
    id: 'corrective-user-user-001',
    category: 'corrective-action',
    severity: 'high',
    title: '利用者Aの改善提案',
    description: '1件の提案があります。',
    targetUser: '利用者A',
    targetUserId: 'user-001',
    targetDate: '2026-03-21',
    updatedAt: '2026-03-21T09:00:00Z',
  },
  {
    id: `ae:${stableId}`,
    parentId: 'corrective-user-user-001',
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
];
let mockCorrectiveItems = defaultCorrectiveItems;

vi.mock('../../../src/features/exceptions/hooks/useCorrectiveActionExceptions', () => ({
  useCorrectiveActionExceptions: vi.fn(() => ({
    items: mockCorrectiveItems,
    count: mockCorrectiveItems.filter((item) => Boolean(item.stableId)).length,
  })),
}));

const defaultHandoffItems: ExceptionItem[] = [
  {
    id: 'handoff-user-user-002',
    category: 'critical-handoff',
    severity: 'critical',
    title: '利用者Bの重要申し送り',
    description: '1件の未完了申し送りがあります。',
    targetUser: '利用者B',
    targetUserId: 'user-002',
    targetDate: '2026-03-21',
    updatedAt: '2026-03-21T09:00:00Z',
  },
  {
    id: 'handoff-handoff-001',
    parentId: 'handoff-user-user-002',
    category: 'critical-handoff',
    severity: 'critical',
    title: '利用者Bの重要申し送り（未対応）',
    description: '要確認',
    targetUser: '利用者B',
    targetUserId: 'user-002',
    targetDate: '2026-03-21',
    updatedAt: '2026-03-21T09:00:00Z',
  },
];
let mockHandoffItems = defaultHandoffItems;

vi.mock('../../../src/features/exceptions/hooks/useHandoffExceptions', () => ({
  useHandoffExceptions: vi.fn(() => ({
    items: mockHandoffItems,
    count: mockHandoffItems.filter((item) => Boolean(item.parentId)).length,
  })),
}));

const defaultDailyRecordItems: ExceptionItem[] = [
  {
    id: 'daily-missing-record-2026-03-21',
    category: 'missing-record',
    severity: 'high',
    title: '2026-03-21 の日々の記録未作成',
    description: '1名の日々の記録が未作成です。',
    targetDate: '2026-03-21',
    updatedAt: '2026-03-21',
  },
  {
    id: 'missing-record-user-001-2026-03-21',
    parentId: 'daily-missing-record-2026-03-21',
    category: 'missing-record',
    severity: 'high',
    title: '利用者Aの日々の記録が未作成',
    description: '日々の記録を作成してください。',
    targetUser: '利用者A',
    targetUserId: 'user-001',
    targetDate: '2026-03-21',
    updatedAt: '2026-03-21',
  },
];
let mockDailyRecordItems = defaultDailyRecordItems;

vi.mock('../../../src/features/exceptions/hooks/useDailyRecordExceptions', () => ({
  useDailyRecordExceptions: vi.fn(() => ({
    items: mockDailyRecordItems,
    count: mockDailyRecordItems.filter((item) => Boolean(item.parentId)).length,
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

const mockUseNotificationDispatcher = vi.fn((_activeEscalations: EscalatedException[]) => ({
  dispatchNotifications: vi.fn(),
  historyCount: 0,
}));
vi.mock('../../../src/features/exceptions/hooks/useNotificationDispatcher', () => ({
  useNotificationDispatcher: (activeEscalations: EscalatedException[]) =>
    mockUseNotificationDispatcher(activeEscalations),
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
    mockCorrectiveItems = defaultCorrectiveItems;
    mockHandoffItems = defaultHandoffItems;
    mockDailyRecordItems = defaultDailyRecordItems;
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
    expect(props.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'missing-record-user-001-2026-03-21',
        parentId: 'daily-missing-record-2026-03-21',
      }),
      expect.objectContaining({
        id: 'handoff-handoff-001',
        parentId: 'handoff-user-user-002',
      }),
      expect.objectContaining({
        id: 'corrective-user-user-001',
      }),
      expect.objectContaining({
        id: `ae:${stableId}`,
        parentId: 'corrective-user-user-001',
      }),
    ]));
    expect(vi.mocked(useCorrectiveActionExceptions)).toHaveBeenCalledWith({
      suggestions: [suggestion],
      states: {},
    });
    expect(
      within(screen.getByText('未解消例外 合計').parentElement as HTMLElement).getByText('5'),
    ).toBeInTheDocument();
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

  it('Corrective P2 child 2件はparentを表示しつつsummary・escalation・notificationから除外する', async () => {
    mockDailyRecordItems = [];
    mockHandoffItems = [];
    mockCorrectiveItems = [
      {
        id: 'corrective-user-user-003',
        category: 'corrective-action',
        severity: 'medium',
        title: '利用者Cの改善提案',
        description: '2件の提案があります。',
        targetUser: '利用者C',
        targetUserId: 'user-003',
        targetDate: '2026-03-21',
        updatedAt: '2026-03-21T10:00:00Z',
      },
      {
        id: 'ae:p2-1',
        parentId: 'corrective-user-user-003',
        category: 'corrective-action',
        severity: 'medium',
        title: '改善提案1',
        description: '根拠1',
        targetUser: '利用者C',
        targetUserId: 'user-003',
        targetDate: '2026-03-21',
        updatedAt: '2026-03-21T10:00:00Z',
        stableId: 'p2-1',
      },
      {
        id: 'ae:p2-2',
        parentId: 'corrective-user-user-003',
        category: 'corrective-action',
        severity: 'medium',
        title: '改善提案2',
        description: '根拠2',
        targetUser: '利用者C',
        targetUserId: 'user-003',
        targetDate: '2026-03-21',
        updatedAt: '2026-03-21T10:00:00Z',
        stableId: 'p2-2',
      },
    ];

    await act(async () => {
      renderWithProviders(<ExceptionCenterPage />);
    });

    const tableProps = vi.mocked(ExceptionTable).mock.lastCall?.[0];
    expect(tableProps?.items).toHaveLength(3);
    expect(
      within(screen.getByText('未解消例外 合計').parentElement as HTMLElement).getByText('2'),
    ).toBeInTheDocument();
    expect(mockUseNotificationDispatcher).toHaveBeenLastCalledWith([]);
    expect(screen.queryByText('⚠️ リーダー警告')).not.toBeInTheDocument();
  });

  it('Corrective P0 child 1件だけをnotification対象にし、parentを重複配送しない', async () => {
    mockDailyRecordItems = [];
    mockHandoffItems = [];
    mockCorrectiveItems = [
      {
        id: 'corrective-user-user-004',
        category: 'corrective-action',
        severity: 'critical',
        title: '利用者Dの改善提案',
        description: '1件の提案があります。',
        targetUser: '利用者D',
        targetUserId: 'user-004',
        targetDate: '2026-03-21',
        updatedAt: '2026-03-21T10:00:00Z',
      },
      {
        id: 'ae:p0-1',
        parentId: 'corrective-user-user-004',
        category: 'corrective-action',
        severity: 'critical',
        title: '即時対応提案',
        description: '重大な根拠',
        targetUser: '利用者D',
        targetUserId: 'user-004',
        targetDate: '2026-03-21',
        updatedAt: '2026-03-21T10:00:00Z',
        stableId: 'p0-1',
      },
    ];

    await act(async () => {
      renderWithProviders(<ExceptionCenterPage />);
    });

    const tableProps = vi.mocked(ExceptionTable).mock.lastCall?.[0];
    expect(tableProps?.items).toHaveLength(2);
    expect(
      within(screen.getByText('未解消例外 合計').parentElement as HTMLElement).getByText('1'),
    ).toBeInTheDocument();

    const activeEscalations = mockUseNotificationDispatcher.mock.lastCall?.[0] ?? [];
    expect(activeEscalations).toHaveLength(1);
    expect(activeEscalations[0]?.item).toMatchObject({
      id: 'ae:p0-1',
      stableId: 'p0-1',
    });
    expect(activeEscalations.some(({ item }) => item.id === 'corrective-user-user-004')).toBe(false);
  });
});
