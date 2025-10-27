import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import NavLinkPrefetch from '@/components/NavLinkPrefetch';
import { PREFETCH_KEYS } from '@/prefetch/routes';
import * as routesModule from '@/prefetch/routes';
import type { PrefetchHandle } from '@/prefetch/prefetch';

const createHandle = (): PrefetchHandle => ({
  cancel: vi.fn(),
  cancelled: false,
  promise: Promise.resolve(),
  reused: false,
});

describe('NavLinkPrefetch debounce behaviour', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('coalesces rapid pointer/focus/touch intents into a single prefetch', async () => {
    vi.useFakeTimers();
    const prefetchSpy = vi
      .spyOn(routesModule, 'prefetchByKey')
      .mockReturnValue(createHandle());

    const { getByRole } = render(
      <MemoryRouter>
        <NavLinkPrefetch to="/schedules/week" preloadKey={PREFETCH_KEYS.schedulesWeek} prefetchOnViewport={false}>
          Schedules
        </NavLinkPrefetch>
      </MemoryRouter>,
    );

    const link = getByRole('link', { name: /schedules/i });

    fireEvent.pointerEnter(link);
    fireEvent.focusIn(link);
    fireEvent.touchStart(link);

    await act(async () => {
      vi.advanceTimersByTime(200);
      await Promise.resolve();
    });

    expect(prefetchSpy).toHaveBeenCalledTimes(1);
    const [key, source] = prefetchSpy.mock.calls[0];
    expect(key).toBe(PREFETCH_KEYS.schedulesWeek);
    expect(source).toBe('hover');
  });
});
