import React from 'react';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

type ObserverWithTrigger = IntersectionObserver & {
  trigger: (entry: Partial<IntersectionObserverEntry>) => void;
};

const makeMockIntersectionObserver = (store: ObserverWithTrigger[]): void => {
  class MockIntersectionObserver implements ObserverWithTrigger {
    readonly callback: IntersectionObserverCallback;
    readonly options?: IntersectionObserverInit;
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = '0px';
    readonly thresholds: ReadonlyArray<number> = [0];
    private disconnected = false;
    observe = vi.fn();
    unobserve = vi.fn();
    takeRecords = vi.fn(() => []);
    disconnect = vi.fn(() => {
      this.disconnected = true;
    });

    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.callback = callback;
      this.options = options;
      store.push(this);
    }

    trigger(entry: Partial<IntersectionObserverEntry>) {
      if (this.disconnected) {
        return;
      }
      this.callback([entry as IntersectionObserverEntry], this);
    }
  }

  (globalThis as typeof globalThis & {
    IntersectionObserver: typeof IntersectionObserver;
  }).IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;
};

describe('NavLinkPrefetch viewport intents', () => {
  const originalIntersectionObserver = globalThis.IntersectionObserver;
  let observers: ObserverWithTrigger[] = [];

  beforeEach(() => {
    observers = [];
    makeMockIntersectionObserver(observers);
  });

  afterEach(() => {
    (globalThis as typeof globalThis & { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver =
      originalIntersectionObserver;
    vi.restoreAllMocks();
  });

  it('fires a single viewport prefetch and disconnects the observer', async () => {
    const prefetchSpy = vi
      .spyOn(routesModule, 'prefetchByKey')
      .mockReturnValue(createHandle());

    const { getByRole } = render(
      <MemoryRouter>
        <NavLinkPrefetch to="/audit" preloadKey={PREFETCH_KEYS.audit}>
          Audit
        </NavLinkPrefetch>
      </MemoryRouter>,
    );

    expect(observers).toHaveLength(1);
    const observer = observers[0];
    const link = getByRole('link', { name: /audit/i });

    observer.trigger({ isIntersecting: true, target: link });
    await Promise.resolve();

    expect(prefetchSpy).toHaveBeenCalledTimes(1);
    expect(prefetchSpy.mock.calls[0]?.[1]).toBe('viewport');
    expect(observer.disconnect).toHaveBeenCalledTimes(1);

    observer.trigger({ isIntersecting: true, target: link });
    await Promise.resolve();

    expect(prefetchSpy).toHaveBeenCalledTimes(1);
  });
});
