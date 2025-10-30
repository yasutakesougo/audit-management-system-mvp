import React, {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { Link, type LinkProps } from 'react-router-dom';

import { prefetchByKey, warmRoute, type PrefetchKey } from '@/prefetch/routes';
import type { PrefetchSource } from '@/prefetch/tracker';

const INTENT_DEBOUNCE_MS = 150;

const lastIntentByKey = new Map<string, number>();

const recordIntent = (key: string, source: PrefetchSource): boolean => {
  const now = Date.now();
  const last = lastIntentByKey.get(key) ?? 0;
  if (source === 'kbd') {
    lastIntentByKey.set(key, now);
    return true;
  }
  if (now - last < INTENT_DEBOUNCE_MS) {
    return false;
  }
  lastIntentByKey.set(key, now);
  return true;
};

export type NavLinkPrefetchProps = LinkProps & {
  preloadKey: PrefetchKey;
  preloadKeys?: PrefetchKey[];
  preload?: () => Promise<unknown>;
  prefetchOnViewport?: boolean;
  prefetchOnHover?: boolean;
  prefetchOnFocus?: boolean;
  prefetchOnTouch?: boolean;
  prefetchOnKeyboard?: boolean;
  disablePrefetch?: boolean;
  viewportMargin?: string;
  ttlMs?: number;
  meta?: Record<string, unknown>;
  signal?: AbortSignal;
};

const DEFAULT_OPTIONS = {
  prefetchOnViewport: true,
  prefetchOnHover: true,
  prefetchOnFocus: true,
  prefetchOnTouch: true,
  prefetchOnKeyboard: true,
  disablePrefetch: false,
  viewportMargin: '80px',
} as const;

const NavLinkPrefetch = forwardRef<HTMLAnchorElement, NavLinkPrefetchProps>((props, ref) => {
  const {
    preloadKey,
    preloadKeys = [],
    preload,
    prefetchOnViewport = DEFAULT_OPTIONS.prefetchOnViewport,
    prefetchOnHover = DEFAULT_OPTIONS.prefetchOnHover,
    prefetchOnFocus = DEFAULT_OPTIONS.prefetchOnFocus,
    prefetchOnTouch = DEFAULT_OPTIONS.prefetchOnTouch,
    prefetchOnKeyboard = DEFAULT_OPTIONS.prefetchOnKeyboard,
    disablePrefetch = DEFAULT_OPTIONS.disablePrefetch,
    viewportMargin = DEFAULT_OPTIONS.viewportMargin,
    ttlMs,
    meta,
    signal,
    onPointerEnter,
    onPointerLeave,
    onFocus,
    onBlur,
    onTouchStart,
    onKeyDown,
    ...rest
  } = props;

  const nodeRef = useRef<HTMLAnchorElement | null>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const intersectionRef = useRef<IntersectionObserver | null>(null);

  const firePrefetch = useCallback((source: PrefetchSource) => {
    if (disablePrefetch) return;
    const keys = new Set<PrefetchKey>([preloadKey, ...preloadKeys]);
    const payloadMeta = meta ? { intent: source, ...meta } : { intent: source };

    for (const key of keys) {
      if ((source === 'hover' || source === 'kbd') && !recordIntent(key, source)) {
        continue;
      }
      if (preload && key === preloadKey) {
        warmRoute(preload, key, {
          source,
          ttlMs,
          meta: payloadMeta,
          signal,
        });
        continue;
      }
      prefetchByKey(key, source, {
        ttlMs,
        meta: payloadMeta,
        signal,
      });
    }
  }, [disablePrefetch, meta, preload, preloadKey, preloadKeys, signal, ttlMs]);

  const scheduleHoverPrefetch = useCallback(() => {
    if (!prefetchOnHover) {
      return;
    }
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
    }
    hoverTimerRef.current = window.setTimeout(() => {
      firePrefetch('hover');
      hoverTimerRef.current = null;
    }, INTENT_DEBOUNCE_MS);
  }, [firePrefetch, prefetchOnHover]);

  const cancelHoverPrefetch = useCallback(() => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  const setRef = useCallback((node: HTMLAnchorElement | null) => {
    nodeRef.current = node;
    if (typeof ref === 'function') {
      ref(node);
    } else if (ref && 'current' in ref) {
      ref.current = node;
    }
  }, [ref]);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node || !prefetchOnViewport || disablePrefetch) {
      return undefined;
    }
    if (typeof window === 'undefined' || typeof IntersectionObserver !== 'function') {
      firePrefetch('viewport');
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          firePrefetch('viewport');
          observer.disconnect();
        }
      });
    }, { rootMargin: viewportMargin });
    intersectionRef.current = observer;
    observer.observe(node);
    return () => {
      observer.disconnect();
      intersectionRef.current = null;
    };
  }, [firePrefetch, disablePrefetch, prefetchOnViewport, viewportMargin, preloadKey]);

  useEffect(() => () => {
    cancelHoverPrefetch();
    const observer = intersectionRef.current;
    if (observer) {
      observer.disconnect();
      intersectionRef.current = null;
    }
  }, [cancelHoverPrefetch]);

  const handlePointerEnter = useCallback((event: React.PointerEvent<HTMLAnchorElement>) => {
    onPointerEnter?.(event);
    scheduleHoverPrefetch();
  }, [onPointerEnter, scheduleHoverPrefetch]);

  const handlePointerLeave = useCallback((event: React.PointerEvent<HTMLAnchorElement>) => {
    onPointerLeave?.(event);
    cancelHoverPrefetch();
  }, [onPointerLeave, cancelHoverPrefetch]);

  const handleFocus = useCallback((event: React.FocusEvent<HTMLAnchorElement>) => {
    onFocus?.(event);
    if (prefetchOnFocus) {
      scheduleHoverPrefetch();
    }
  }, [onFocus, prefetchOnFocus, scheduleHoverPrefetch]);

  const handleBlur = useCallback((event: React.FocusEvent<HTMLAnchorElement>) => {
    onBlur?.(event);
    cancelHoverPrefetch();
  }, [onBlur, cancelHoverPrefetch]);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLAnchorElement>) => {
    onTouchStart?.(event);
    if (prefetchOnTouch) {
      scheduleHoverPrefetch();
    }
  }, [onTouchStart, prefetchOnTouch, scheduleHoverPrefetch]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLAnchorElement>) => {
    onKeyDown?.(event);
    if (!prefetchOnKeyboard) {
      return;
    }
    const key = event.key.toLowerCase();
    if (key === 'enter' || key === ' ' || key === 'spacebar' || key === 'arrowright' || key === 'arrowdown') {
      firePrefetch('kbd');
    }
  }, [onKeyDown, prefetchOnKeyboard, firePrefetch]);

  return (
    <Link
      {...rest}
      ref={setRef}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onTouchStart={handleTouchStart}
      onKeyDown={handleKeyDown}
    />
  );
});

NavLinkPrefetch.displayName = 'NavLinkPrefetch';

export { NavLinkPrefetch };
export default NavLinkPrefetch;
