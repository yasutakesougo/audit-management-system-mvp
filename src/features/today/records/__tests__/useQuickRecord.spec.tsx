// ---------------------------------------------------------------------------
// useQuickRecord – URL state + localStorage テスト (#628)
// ---------------------------------------------------------------------------
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useQuickRecord } from '../useQuickRecord';

// Router wrapper（useSearchParams を使うため）
function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

function wrapperWithParams(initialEntries: string[]) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
  };
}

const AUTO_NEXT_KEY = 'ams_quick_auto_next';

describe('useQuickRecord', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // 初期状態
  // -----------------------------------------------------------------------
  it('starts with drawer closed and autoNext enabled by default', () => {
    const { result } = renderHook(() => useQuickRecord(), { wrapper });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.mode).toBeNull();
    expect(result.current.userId).toBeNull();
    expect(result.current.autoNextEnabled).toBe(true);
  });

  // -----------------------------------------------------------------------
  // openUnfilled
  // -----------------------------------------------------------------------
  it('openUnfilled sets mode and userId', () => {
    const { result } = renderHook(() => useQuickRecord(), { wrapper });

    act(() => {
      result.current.openUnfilled('U001');
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.mode).toBe('unfilled');
    expect(result.current.userId).toBe('U001');
  });

  it('openUnfilled without targetUserId opens in unfilled mode', () => {
    const { result } = renderHook(() => useQuickRecord(), { wrapper });

    act(() => {
      result.current.openUnfilled();
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.mode).toBe('unfilled');
    expect(result.current.userId).toBeNull();
  });

  // -----------------------------------------------------------------------
  // openUser
  // -----------------------------------------------------------------------
  it('openUser sets mode=user and userId', () => {
    const { result } = renderHook(() => useQuickRecord(), { wrapper });

    act(() => {
      result.current.openUser('U042');
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.mode).toBe('user');
    expect(result.current.userId).toBe('U042');
  });

  // -----------------------------------------------------------------------
  // close
  // -----------------------------------------------------------------------
  it('close removes mode and userId', () => {
    const { result } = renderHook(() => useQuickRecord(), { wrapper });

    act(() => {
      result.current.openUnfilled('U001');
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.close();
    });

    expect(result.current.isOpen).toBe(false);
    expect(result.current.mode).toBeNull();
    expect(result.current.userId).toBeNull();
  });

  // -----------------------------------------------------------------------
  // autoNext toggle
  // -----------------------------------------------------------------------
  it('setAutoNextEnabled persists to localStorage', () => {
    const { result } = renderHook(() => useQuickRecord(), { wrapper });

    act(() => {
      result.current.setAutoNextEnabled(false);
    });

    expect(result.current.autoNextEnabled).toBe(false);
    expect(localStorage.getItem(AUTO_NEXT_KEY)).toBe('0');
  });

  it('setAutoNextEnabled(true) writes 1 to localStorage', () => {
    const { result } = renderHook(() => useQuickRecord(), { wrapper });

    act(() => {
      result.current.setAutoNextEnabled(false);
    });
    act(() => {
      result.current.setAutoNextEnabled(true);
    });

    expect(result.current.autoNextEnabled).toBe(true);
    expect(localStorage.getItem(AUTO_NEXT_KEY)).toBe('1');
  });

  // -----------------------------------------------------------------------
  // localStorage fallback
  // -----------------------------------------------------------------------
  it('reads autoNext from localStorage when URL has no autoNext param', () => {
    localStorage.setItem(AUTO_NEXT_KEY, '0');

    const { result } = renderHook(() => useQuickRecord(), { wrapper });

    expect(result.current.autoNextEnabled).toBe(false);
  });

  it('defaults autoNext to true when localStorage is empty', () => {
    localStorage.removeItem(AUTO_NEXT_KEY);

    const { result } = renderHook(() => useQuickRecord(), { wrapper });

    expect(result.current.autoNextEnabled).toBe(true);
  });

  // -----------------------------------------------------------------------
  // URL param restoration (reload simulation)
  // -----------------------------------------------------------------------
  it('restores state from URL params on mount (reload scenario)', () => {
    const Wrapper = wrapperWithParams(['/today?mode=unfilled&userId=U005&autoNext=1']);

    const { result } = renderHook(() => useQuickRecord(), { wrapper: Wrapper });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.mode).toBe('unfilled');
    expect(result.current.userId).toBe('U005');
    expect(result.current.autoNextEnabled).toBe(true);
  });

  it('restores autoNext=0 from URL params', () => {
    const Wrapper = wrapperWithParams(['/today?mode=unfilled&userId=U005&autoNext=0']);

    const { result } = renderHook(() => useQuickRecord(), { wrapper: Wrapper });

    expect(result.current.autoNextEnabled).toBe(false);
  });

  // -----------------------------------------------------------------------
  // localStorage error resilience
  // -----------------------------------------------------------------------
  it('does not crash when localStorage throws on read', () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('SecurityError');
    };

    const { result } = renderHook(() => useQuickRecord(), { wrapper });

    // Default fallback: true
    expect(result.current.autoNextEnabled).toBe(true);

    Storage.prototype.getItem = original;
  });

  it('does not crash when localStorage throws on write', () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error('QuotaExceeded');
    };

    const { result } = renderHook(() => useQuickRecord(), { wrapper });

    expect(() => {
      act(() => {
        result.current.setAutoNextEnabled(false);
      });
    }).not.toThrow();

    Storage.prototype.setItem = original;
  });
});
