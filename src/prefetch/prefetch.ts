import { canPrefetch } from './net';
import {
  beginPrefetch,
  finalizePrefetch,
  isPrefetchFresh,
  markPrefetchReuse,
  touchPrefetch,
  type PrefetchSource,
} from './tracker';

export type PrefetchRequest = {
  key: string;
  importer: () => Promise<unknown>;
  source: PrefetchSource;
  ttlMs?: number;
  meta?: Record<string, unknown>;
  signal?: AbortSignal;
};

export type PrefetchHandle = {
  cancelled: boolean;
  cancel: () => void;
  promise: Promise<void>;
  reused: boolean;
};

const controllers = new Map<string, AbortController>();

/**
 * Aborts a prefetch operation by key.
 * @param key The prefetch key to abort
 * @note Only aborts the most recently started prefetch for the given key.
 * If multiple prefetch operations were started with the same key,
 * only the latest one will be aborted.
 */
export const abortPrefetch = (key: string): void => {
  const controller = controllers.get(key);
  if (!controller) {
    return;
  }
  controllers.delete(key);
  controller.abort();
};

/**
 * Initiates a prefetch operation with caching, abort handling, and network conditions.
 * @param request The prefetch request configuration
 * @returns A handle to monitor and control the prefetch operation
 * @note If a prefetch with the same key is already fresh (within TTL),
 * returns a reused handle without starting a new operation.
 */
export const prefetch = ({ key, importer, source, ttlMs, meta, signal }: PrefetchRequest): PrefetchHandle => {
  if (isPrefetchFresh(key, ttlMs)) {
    markPrefetchReuse(key, source, meta);
    return {
      cancelled: false,
      cancel: () => {},
      promise: Promise.resolve(),
      reused: true,
    };
  }

  if (!canPrefetch(source)) {
    finalizePrefetch(key, 'skipped');
    return {
      cancelled: false,
      cancel: () => {},
      promise: Promise.resolve(),
      reused: false,
    };
  }

  const controller = new AbortController();
  controllers.set(key, controller);
  const externalSignal = signal;
  const abortListener = () => {
    controller.abort();
  };
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort(externalSignal.reason);
    } else {
      externalSignal.addEventListener('abort', abortListener, { once: true });
    }
  }

  beginPrefetch(key, source, meta, ttlMs);

  const wrappedImport = async () => {
    try {
      const race = await Promise.race([
        importer(),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener(
            'abort',
            () => {
              const abortError =
                controller.signal.reason ??
                (typeof DOMException !== 'undefined'
                  ? new DOMException('Prefetch aborted', 'AbortError')
                  : new Error('Prefetch aborted'));
              reject(abortError);
            },
            { once: true }
          );
        }),
      ]);
      touchPrefetch(key);
      finalizePrefetch(key, 'completed');
      return race;
    } catch (error) {
      if (controller.signal.aborted) {
        finalizePrefetch(key, 'aborted', error);
      } else {
        finalizePrefetch(key, 'error', error);
      }
      throw error;
    } finally {
      controllers.delete(key);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', abortListener);
      }
    }
  };

  const promise = wrappedImport().catch(() => {
    // swallow errors for callers who do not await
  });

  const handle: PrefetchHandle = {
    cancelled: false,
    reused: false,
    cancel: () => {
      if (controllers.get(key) === controller) {
        controller.abort();
        controllers.delete(key);
      }
      handle.cancelled = true;
    },
    promise: promise.then(() => {
      handle.cancelled = controller.signal.aborted;
    }),
  };

  return handle;
};
