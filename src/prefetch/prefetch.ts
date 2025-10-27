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

export const abortPrefetch = (key: string): void => {
  const controller = controllers.get(key);
  if (!controller) {
    return;
  }
  controllers.delete(key);
  controller.abort();
};

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

  let cancelled = false;
  beginPrefetch(key, source, meta, ttlMs);

  const wrappedImport = async () => {
    try {
      const race = await Promise.race([
        importer(),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener(
            'abort',
            () => {
              cancelled = true;
              reject(controller.signal.reason ?? new DOMException('Prefetch aborted', 'AbortError'));
            },
            { once: true }
          );
        }),
      ]);
      touchPrefetch(key);
      finalizePrefetch(key, 'completed');
      return race;
    } catch (error) {
      if (controller.signal.aborted || cancelled) {
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
