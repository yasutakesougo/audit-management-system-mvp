// src/utils/prefetch.ts
import { shouldPrefetch } from '@/utils/net';

const seenKeys = new Set<string>();
const isDebugBuild = typeof import.meta !== 'undefined' && !import.meta.env.PROD;
const isTestMode = typeof import.meta !== 'undefined' && import.meta.env.MODE === 'test';

const recordPrefetch = (key: string): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const globalAny = window as unknown as {
    __prefetchCount?: number;
    __prefetchKeys?: string[];
  };

  const shouldTrack = isDebugBuild || isTestMode;

  if (shouldTrack) {
    globalAny.__prefetchCount = (globalAny.__prefetchCount ?? 0) + 1;
  }

  if (shouldTrack) {
    const keys = Array.isArray(globalAny.__prefetchKeys) ? globalAny.__prefetchKeys : [];
    if (!globalAny.__prefetchKeys) {
      globalAny.__prefetchKeys = keys;
    }
    if (!keys.includes(key)) {
      keys.push(key);
    }
  }
};

export function prefetch(importer: () => Promise<unknown>, key: string): void {
  if (seenKeys.has(key)) {
    return;
  }
  if (typeof window === 'undefined') {
    return;
  }
  if (!shouldPrefetch()) {
    return;
  }

  seenKeys.add(key);
  recordPrefetch(key);

  try {
    void importer().catch(() => {
      // silence loader failures at idle time
    });
  } catch {
    // ignore importer sync failures
  }
}
