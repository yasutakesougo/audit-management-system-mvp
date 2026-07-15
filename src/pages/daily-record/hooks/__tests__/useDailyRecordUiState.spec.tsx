import { act, renderHook } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mockRecords } from '../../../dailyRecordMockData';
import { useDailyRecordUiState } from '../useDailyRecordUiState';

describe('useDailyRecordUiState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps actions stable across state-driven rerenders', () => {
    const { result, rerender } = renderHook(() => useDailyRecordUiState(mockRecords));
    const firstActions = result.current.actions;

    rerender();
    expect(result.current.actions).toBe(firstActions);

    act(() => result.current.actions.setSearchQuery('田中'));
    expect(result.current.actions).toBe(firstActions);
  });

  it('does not recreate an action-dependent timer for the same highlight', () => {
    const onHighlight = vi.fn();
    const { rerender } = renderHook(
      ({ highlight }) => {
        const { actions } = useDailyRecordUiState(mockRecords);
        useEffect(() => {
          const timer = window.setTimeout(() => onHighlight(highlight), 100);
          return () => window.clearTimeout(timer);
        }, [actions, highlight]);
      },
      { initialProps: { highlight: '001' } },
    );

    act(() => vi.advanceTimersByTime(50));
    rerender({ highlight: '001' });
    act(() => vi.advanceTimersByTime(50));

    expect(onHighlight).toHaveBeenCalledOnce();
    expect(onHighlight).toHaveBeenCalledWith('001');
  });

  it('restarts the timer only when the highlight changes', () => {
    const onHighlight = vi.fn();
    const { rerender } = renderHook(
      ({ highlight }) => {
        const { actions } = useDailyRecordUiState(mockRecords);
        useEffect(() => {
          const timer = window.setTimeout(() => onHighlight(highlight), 100);
          return () => window.clearTimeout(timer);
        }, [actions, highlight]);
      },
      { initialProps: { highlight: '001' } },
    );

    act(() => vi.advanceTimersByTime(50));
    rerender({ highlight: '002' });
    act(() => vi.advanceTimersByTime(99));
    expect(onHighlight).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onHighlight).toHaveBeenCalledOnce();
    expect(onHighlight).toHaveBeenCalledWith('002');
  });

  it('clears the timer on unmount', () => {
    const onHighlight = vi.fn();
    const { unmount } = renderHook(() => {
      const { actions } = useDailyRecordUiState(mockRecords);
      useEffect(() => {
        const timer = window.setTimeout(onHighlight, 100);
        return () => window.clearTimeout(timer);
      }, [actions]);
    });

    unmount();
    act(() => vi.runAllTimers());
    expect(onHighlight).not.toHaveBeenCalled();
  });
});
