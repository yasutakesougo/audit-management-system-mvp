import React from 'react';
import { fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import NavLinkPrefetch from '@/components/NavLinkPrefetch';
import { PREFETCH_KEYS } from '@/prefetch/routes';
import * as routesModule from '@/prefetch/routes';
import type { PrefetchHandle } from '@/prefetch/prefetch';
import { renderWithAppProviders } from '../helpers/renderWithAppProviders';

const createHandle = (): PrefetchHandle => ({
  cancel: vi.fn(),
  cancelled: false,
  promise: Promise.resolve(),
  reused: false,
});

describe('NavLinkPrefetch keyboard intents', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('records source="kbd" when activated via Enter', async () => {
    const prefetchSpy = vi
      .spyOn(routesModule, 'prefetchByKey')
      .mockReturnValue(createHandle());

    const { getAllByRole } = renderWithAppProviders(
      <NavLinkPrefetch
        to="/schedules/week"
        preloadKey={PREFETCH_KEYS.schedulesWeek}
        prefetchOnViewport={false}
        prefetchOnHover={false}
        prefetchOnFocus={false}
      >
        Schedules
      </NavLinkPrefetch>
    );

    const [link] = getAllByRole('link', { name: /schedules/i });

    fireEvent.focus(link);
    fireEvent.keyDown(link, { key: 'Enter' });

    await Promise.resolve();

    expect(prefetchSpy).toHaveBeenCalledTimes(1);
    const [, source, options] = prefetchSpy.mock.calls[0];
    expect(source).toBe('kbd');
    expect(options?.meta).toMatchObject({ intent: 'kbd' });
  });

  it('ignores non-activation keys for keyboard intents', async () => {
    const prefetchSpy = vi
      .spyOn(routesModule, 'prefetchByKey')
      .mockReturnValue(createHandle());

    const { getAllByRole } = renderWithAppProviders(
      <NavLinkPrefetch
        to="/schedules/week"
        preloadKey={PREFETCH_KEYS.schedulesWeek}
        prefetchOnViewport={false}
        prefetchOnHover={false}
        prefetchOnFocus={false}
      >
        Schedules
      </NavLinkPrefetch>
    );

    const [link] = getAllByRole('link', { name: /schedules/i });

    fireEvent.focus(link);
    fireEvent.keyDown(link, { key: 'ArrowLeft' });

    await Promise.resolve();

    expect(prefetchSpy).not.toHaveBeenCalled();
  });
});
