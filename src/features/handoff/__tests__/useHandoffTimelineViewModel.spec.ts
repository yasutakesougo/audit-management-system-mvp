import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { HandoffDayScope, HandoffTimeFilter, MeetingMode } from '../handoffTypes';
import { useHandoffTimelineViewModel } from '../useHandoffTimelineViewModel';

describe('useHandoffTimelineViewModel', () => {
  it('initializes state from navigation values', () => {
    const navState = {
      dayScope: 'yesterday' as HandoffDayScope,
      timeFilter: 'morning' as HandoffTimeFilter,
    };

    const { result } = renderHook(() => useHandoffTimelineViewModel({ navState }));

    expect(result.current.dayScope).toBe('yesterday');
    expect(result.current.timeFilter).toBe('morning');
  });

  describe('meetingMode', () => {
    it('defaults to "normal"', () => {
      const { result } = renderHook(() => useHandoffTimelineViewModel({}));
      expect(result.current.meetingMode).toBe('normal');
    });

    it('can be changed via handleMeetingModeChange', () => {
      const { result } = renderHook(() => useHandoffTimelineViewModel({}));

      act(() => {
        result.current.handleMeetingModeChange(
          {} as React.MouseEvent<HTMLElement>,
          'evening' as MeetingMode,
        );
      });

      expect(result.current.meetingMode).toBe('evening');
    });

    it('ignores null value (ToggleButtonGroup deselect)', () => {
      const { result } = renderHook(() => useHandoffTimelineViewModel({}));

      act(() => {
        result.current.handleMeetingModeChange(
          {} as React.MouseEvent<HTMLElement>,
          'evening' as MeetingMode,
        );
      });

      act(() => {
        // ToggleButtonGroup sends null when deselecting
        result.current.handleMeetingModeChange(
          {} as React.MouseEvent<HTMLElement>,
          null as unknown as MeetingMode,
        );
      });

      expect(result.current.meetingMode).toBe('evening');
    });
  });

  describe('markReviewed guard', () => {
    it('does not throw when called (no-op for non-未対応)', () => {
      const { result } = renderHook(() => useHandoffTimelineViewModel({}));
      // markReviewed guards by checking currentStatus
      // calling with '対応中' should be a no-op (not throw)
      expect(() => result.current.markReviewed(1, '対応中')).not.toThrow();
    });

    it('does not throw when called with 未対応', () => {
      const { result } = renderHook(() => useHandoffTimelineViewModel({}));
      // This will call updateHandoffStatusVm which has no ref set, but should not throw
      expect(() => result.current.markReviewed(1, '未対応')).not.toThrow();
    });
  });

  describe('markCarryOver guard', () => {
    it('does not throw when called with non-確認済 (no-op)', () => {
      const { result } = renderHook(() => useHandoffTimelineViewModel({}));
      expect(() => result.current.markCarryOver(1, '未対応')).not.toThrow();
    });
  });

  describe('markClosed guard', () => {
    it('does not throw when called with terminal status (no-op)', () => {
      const { result } = renderHook(() => useHandoffTimelineViewModel({}));
      expect(() => result.current.markClosed(1, '完了')).not.toThrow();
    });

    it('does not throw when called with 未対応 (no-op)', () => {
      const { result } = renderHook(() => useHandoffTimelineViewModel({}));
      expect(() => result.current.markClosed(1, '未対応')).not.toThrow();
    });
  });
});
