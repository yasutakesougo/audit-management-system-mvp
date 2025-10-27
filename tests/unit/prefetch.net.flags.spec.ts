import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  canPrefetch,
  setNetworkSnapshotOverride,
  setOnlineOverride,
  setPrefetchDisableOverride,
  setSaveDataOverride,
} from '@/prefetch/net';

const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

const resetOverrides = () => {
  setPrefetchDisableOverride(null);
  setNetworkSnapshotOverride(null);
  setSaveDataOverride(null);
  setOnlineOverride(null);
  vi.unstubAllEnvs();
  if (originalNavigatorDescriptor) {
    Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
  } else {
    Reflect.deleteProperty(globalThis as typeof globalThis & { navigator?: Navigator }, 'navigator');
  }
};

describe('canPrefetch network guards', () => {
  beforeEach(() => {
    resetOverrides();
  });

  afterEach(() => {
    resetOverrides();
  });

  it('respects the VITE_PREFETCH_DISABLE environment toggle', () => {
    vi.stubEnv('VITE_PREFETCH_DISABLE', '1');
    expect(canPrefetch('hover')).toBe(false);
  });

  it('suppresses prefetch when Save-Data is enabled', () => {
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: {
        connection: { saveData: true },
        onLine: true,
      },
    });
    expect(canPrefetch('hover')).toBe(false);
  });

  it('allows interactive intents but blocks passive ones on slow connections', () => {
    setNetworkSnapshotOverride({ downlink: 1.2, online: true });
    expect(canPrefetch('hover')).toBe(true);
    expect(canPrefetch('kbd')).toBe(true);
    expect(canPrefetch('viewport')).toBe(false);
    expect(canPrefetch('idle')).toBe(false);
  });

  it('blocks viewport prefetches on high latency while keeping hover intact', () => {
    setNetworkSnapshotOverride({ rtt: 900, online: true });
    expect(canPrefetch('viewport')).toBe(false);
    expect(canPrefetch('hover')).toBe(true);
  });

  it('disallows prefetch when offline', () => {
    setOnlineOverride(false);
    expect(canPrefetch('hover')).toBe(false);
  });
});
