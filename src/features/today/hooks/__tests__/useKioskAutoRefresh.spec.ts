import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

import { useKioskAutoRefresh } from '../useKioskAutoRefresh';

function setVisibilityState(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: state,
  });
}

describe('useKioskAutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setVisibilityState('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('polls while visible and refreshes immediately on visibility restore', () => {
    const onRefresh = vi.fn();
    renderHook(() =>
      useKioskAutoRefresh({
        enabled: true,
        intervalMs: 1_000,
        onRefresh,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    act(() => {
      setVisibilityState('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
      vi.advanceTimersByTime(3_000);
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    act(() => {
      setVisibilityState('visible');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(onRefresh).toHaveBeenCalledTimes(2);

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(onRefresh).toHaveBeenCalledTimes(3);
  });

  it('does not run when disabled', () => {
    const onRefresh = vi.fn();
    renderHook(() =>
      useKioskAutoRefresh({
        enabled: false,
        intervalMs: 1_000,
        onRefresh,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(5_000);
      setVisibilityState('visible');
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });
});

