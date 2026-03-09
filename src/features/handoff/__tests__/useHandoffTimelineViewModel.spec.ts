import { act, renderHook } from '@testing-library/react';
import type { HandoffDayScope, HandoffTimeFilter } from '../handoffTypes';
import { useHandoffTimelineViewModel } from '../useHandoffTimelineViewModel';

// Mock the logger to verify structured calls
const { mockLogWorkflowBlocked } = vi.hoisted(() => ({
  mockLogWorkflowBlocked: vi.fn(),
}));

vi.mock('../actions/handoffActions.logger', () => ({
  logWorkflowBlocked: mockLogWorkflowBlocked,
}));

describe('useHandoffTimelineViewModel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('initializes state from navigation values', () => {
    const navState = {
      dayScope: 'yesterday' as HandoffDayScope,
      timeFilter: 'morning' as HandoffTimeFilter,
    };

    const { result } = renderHook(() => useHandoffTimelineViewModel({ navState }));

    expect(result.current.dayScope).toBe('yesterday');
    expect(result.current.timeFilter).toBe('morning');
  });

  it('meetingMode defaults to normal', () => {
    const { result } = renderHook(() => useHandoffTimelineViewModel({}));
    expect(result.current.meetingMode).toBe('normal');
  });

  it('workflowActions is an object with 3 methods', () => {
    const { result } = renderHook(() => useHandoffTimelineViewModel({}));
    expect(result.current.workflowActions).toBeDefined();
    expect(typeof result.current.workflowActions.markReviewed).toBe('function');
    expect(typeof result.current.workflowActions.markCarryOver).toBe('function');
    expect(typeof result.current.workflowActions.markClosed).toBe('function');
  });

  it('injectDI is a function', () => {
    const { result } = renderHook(() => useHandoffTimelineViewModel({}));
    expect(typeof result.current.injectDI).toBe('function');
  });

  it('handleMeetingModeChange sets dayScope/timeFilter for evening', () => {
    const { result } = renderHook(() => useHandoffTimelineViewModel({}));

    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.current.handleMeetingModeChange({} as any, 'evening');
    });

    expect(result.current.meetingMode).toBe('evening');
    expect(result.current.dayScope).toBe('today');
    expect(result.current.timeFilter).toBe('evening');
  });

  it('handleMeetingModeChange sets dayScope/timeFilter for morning', () => {
    const { result } = renderHook(() => useHandoffTimelineViewModel({}));

    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.current.handleMeetingModeChange({} as any, 'morning');
    });

    expect(result.current.meetingMode).toBe('morning');
    expect(result.current.dayScope).toBe('yesterday');
    expect(result.current.timeFilter).toBe('morning');
  });

  it('calls logWorkflowBlocked with di_not_provided when updateHandoffStatus not injected', async () => {
    const { result } = renderHook(() => useHandoffTimelineViewModel({}));

    // Switch to evening mode where 未対応 → 確認済 is allowed
    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.current.handleMeetingModeChange({} as any, 'evening');
    });

    // Inject records so guard passes, but no updateHandoffStatus
    act(() => {
      result.current.injectDI({
        updateHandoffStatus: undefined as unknown as (id: number, newStatus: string, carryOverDate?: string) => Promise<void>,
        currentRecords: [{ id: 1, status: '未対応' }] as never[],
      });
    });

    // Try to call markReviewed - should log structured event since no update function
    await act(async () => {
      await result.current.workflowActions.markReviewed(1);
    });

    expect(mockLogWorkflowBlocked).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        attemptedAction: 'markReviewed',
        reason: 'di_not_provided',
      }),
    );
  });
});
