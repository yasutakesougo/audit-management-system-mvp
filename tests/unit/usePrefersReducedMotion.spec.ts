import { usePrefersReducedMotion } from '@/lib/a11y/usePrefersReducedMotion';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('usePrefersReducedMotion', () => {
  const originalMatchMedia = globalThis.matchMedia;

  afterEach(() => {
    if (originalMatchMedia) {
      globalThis.matchMedia = originalMatchMedia;
    } else {
      Reflect.deleteProperty(globalThis, 'matchMedia');
    }
  });

  it('reflects the initial preference and reacts to changes', () => {
    let listeners: Array<(event: MediaQueryListEvent) => void> = [];
    let currentMatches = true;

    const mockMediaQueryList: MediaQueryList = {
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addEventListener: (_event: string, handler: (event: MediaQueryListEvent) => void) => {
        listeners.push(handler);
      },
      removeEventListener: (_event: string, handler: (event: MediaQueryListEvent) => void) => {
        listeners = listeners.filter((listener) => listener !== handler);
      },
      addListener: (handler: (event: MediaQueryListEvent) => void) => {
        listeners.push(handler);
      },
      removeListener: (handler: (event: MediaQueryListEvent) => void) => {
        listeners = listeners.filter((listener) => listener !== handler);
      },
      dispatchEvent: vi.fn(),
      matches: true,
    } as MediaQueryList;

    Object.defineProperty(mockMediaQueryList, 'matches', {
      get: () => currentMatches,
    });

    const mockMatchMedia = vi.fn().mockReturnValue(mockMediaQueryList);

    (globalThis as typeof globalThis & { matchMedia: typeof window.matchMedia })
      .matchMedia = mockMatchMedia;

    const { result } = renderHook(() => usePrefersReducedMotion());

    expect(result.current).toBe(true);
    expect(mockMatchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');

    act(() => {
      currentMatches = false;
      listeners.forEach((listener) => listener({ matches: false } as MediaQueryListEvent));
    });

    expect(result.current).toBe(false);
  });
});
