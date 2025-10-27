import React, { createContext, useCallback, useContext, useEffect, useRef } from 'react';
import { useLocation, useNavigation } from 'react-router-dom';
import {
  beginHydrationSpan,
  finalizeHydrationSpan,
  updateHydrationSpanMeta,
} from '@/lib/hydrationHud';
import { resolveHydrationEntry, type HydrationRouteEntry } from './routes';

type ActiveSpan = {
  entry: HydrationRouteEntry;
  pathname: string;
  search: string;
  key: string;
  complete: ReturnType<typeof beginHydrationSpan> | null;
  source: 'navigation' | 'passive' | 'history';
  reason: string;
  cancel?: () => void;
};

type HydrationErrorHandler = (error: unknown) => void;

const RouteHydrationErrorContext = createContext<HydrationErrorHandler | null>(null);

const useRouteHydrationErrorHandler = (): HydrationErrorHandler => {
  const handler = useContext(RouteHydrationErrorContext);
  if (!handler) {
    return () => {};
  }
  return handler;
};

const makeKey = (pathname: string, search: string): string => `${pathname ?? ''}|${search ?? ''}`;

const buildMeta = (
  entry: HydrationRouteEntry,
  pathname: string,
  search: string,
  extra?: Record<string, unknown>
) => ({
  budget: entry.budget,
  path: pathname,
  search,
  ...extra,
});

const PASSIVE_COMPLETE_DELAY = 120;

const schedulePassiveCompletion = (callback: () => void): (() => void) | undefined => {
  if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') {
    const handle = window.setTimeout(() => callback(), PASSIVE_COMPLETE_DELAY);
    return () => window.clearTimeout(handle);
  }

  const handle = setTimeout(() => callback(), PASSIVE_COMPLETE_DELAY);
  return () => clearTimeout(handle);
};

const finalizeSpan = (span: ActiveSpan | null, error?: unknown, extra?: Record<string, unknown>) => {
  if (!span) return;
  if (span.cancel) {
    span.cancel();
    span.cancel = undefined;
  }
  finalizeHydrationSpan(
    span.complete,
    error,
    buildMeta(span.entry, span.pathname, span.search, extra)
  );
};

const toErrorString = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

type RouteHydrationListenerProps = {
  children?: React.ReactNode;
};

const RouteHydrationListener: React.FC<RouteHydrationListenerProps> = ({ children }) => {
  const navigation = useNavigation();
  const location = useLocation();
  const currentKey = makeKey(location.pathname, location.search ?? '');
  const pendingRef = useRef<ActiveSpan | null>(null);
  const previousKeyRef = useRef<string>(currentKey);
  const historyNavigationRef = useRef(false);
  const previousLocationRef = useRef<{ pathname: string; search: string; hash: string } | null>(
    location
      ? {
          pathname: location.pathname,
          search: location.search,
          hash: location.hash,
        }
      : null
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const handlePopState = () => {
      historyNavigationRef.current = true;
      if (pendingRef.current?.cancel) {
        pendingRef.current.cancel();
        pendingRef.current.cancel = undefined;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const handleRouteError = useCallback((error: unknown) => {
    const pending = pendingRef.current;
    if (!pending) {
      return;
    }
    pendingRef.current = null;
    finalizeSpan(pending, error, {
      status: 'error',
      source: pending.source,
      reason: 'lazy-import',
      error: toErrorString(error),
    });
  }, []);

  useEffect(() => {
    if (navigation.state !== 'loading' || !navigation.location) {
      return;
    }

    const targetPath = navigation.location.pathname ?? '';
    const targetSearch = navigation.location.search ?? '';
    const targetKey = makeKey(targetPath, targetSearch);
    const entry = resolveHydrationEntry(targetPath, targetSearch);

    if (!entry) {
      if (pendingRef.current) {
        const span = pendingRef.current;
        pendingRef.current = null;
        finalizeSpan(span, undefined, { status: 'ignored', source: span.source, reason: span.reason });
      }
      return;
    }

    if (pendingRef.current && pendingRef.current.key === targetKey) {
      return;
    }

    if (pendingRef.current) {
      const span = pendingRef.current;
      pendingRef.current = null;
      finalizeSpan(span, undefined, { status: 'superseded', source: span.source, reason: span.reason });
    }

    pendingRef.current = {
      entry,
      pathname: targetPath,
      search: targetSearch,
      key: targetKey,
      source: 'navigation',
      reason: 'navigation',
      complete: beginHydrationSpan(entry.id, {
        id: entry.id,
        label: entry.label,
        group: 'hydration:route',
        meta: buildMeta(entry, targetPath, targetSearch, {
          status: 'pending',
          source: 'navigation',
          reason: 'navigation',
        }),
      }),
    };
  }, [navigation.state, navigation.location]);

  useEffect(() => {
    const pathname = location.pathname ?? '';
    const search = location.search ?? '';
    const hash = location.hash ?? '';

    const snapshot = { pathname, search, hash };
    const previousLocation = previousLocationRef.current;
    const samePath = previousLocation?.pathname === pathname;
    const sameSearch = previousLocation?.search === search;
    const sameHash = previousLocation?.hash === hash;

    const nextKey = makeKey(pathname, search);
    const previousKey = previousKeyRef.current;

    if (samePath && sameSearch && !sameHash) {
      previousLocationRef.current = snapshot;
      previousKeyRef.current = nextKey;
      return;
    }

    if (previousKey === nextKey && samePath && sameSearch) {
      previousLocationRef.current = snapshot;
      return;
    }

    previousLocationRef.current = snapshot;
    previousKeyRef.current = nextKey;

    if (pendingRef.current && pendingRef.current.key === nextKey) {
      return;
    }

    const entry = resolveHydrationEntry(pathname, search);
    const isHistoryNavigation = historyNavigationRef.current;
    if (isHistoryNavigation) {
      historyNavigationRef.current = false;
    }

    const pending = pendingRef.current;
    const isSearchDelta = samePath && !sameSearch;

    if (!entry) {
      if (pending) {
        pendingRef.current = null;
        finalizeSpan(pending, undefined, { status: 'ignored', source: pending.source, reason: pending.reason });
      }
      return;
    }

    if (isSearchDelta && pending && pending.entry.id === entry.id) {
      pending.pathname = pathname;
      pending.search = search;
      pending.key = nextKey;
      pending.reason = 'search';

      updateHydrationSpanMeta(entry.id, buildMeta(entry, pathname, search, {
        status: 'pending',
        source: pending.source,
        reason: 'search',
        searchUpdated: true,
      }));

      if (pending.cancel) {
        pending.cancel();
      }

      const finalizeLater = () => {
        const active = pendingRef.current;
        if (!active || active.key !== nextKey) {
          return;
        }
        pendingRef.current = null;
        finalizeSpan(active, undefined, { status: 'completed', source: active.source, reason: active.reason });
      };

      pending.cancel = schedulePassiveCompletion(finalizeLater);
      return;
    }

    if (pending) {
      pendingRef.current = null;
      finalizeSpan(pending, undefined, { status: 'superseded', source: pending.source, reason: pending.reason });
    }

    const source: ActiveSpan['source'] = isHistoryNavigation ? 'history' : 'passive';
    const reason = isSearchDelta ? 'search' : source;

    const complete = beginHydrationSpan(entry.id, {
      id: entry.id,
      label: entry.label,
      group: 'hydration:route',
      meta: buildMeta(entry, pathname, search, {
        status: 'pending',
        source,
        reason,
        ...(isSearchDelta ? { searchUpdated: true } : {}),
      }),
    });

    const finalizeLater = () => {
      const active = pendingRef.current;
      if (!active || active.key !== nextKey) {
        return;
      }
      pendingRef.current = null;
      finalizeSpan(active, undefined, { status: 'completed', source: active.source, reason: active.reason });
    };

    const cancel = schedulePassiveCompletion(finalizeLater);

    pendingRef.current = {
      entry,
      pathname,
      search,
      key: nextKey,
      complete,
      source,
      reason,
      cancel,
    };
  }, [currentKey, location.pathname, location.search, location.hash]);

  useEffect(() => {
    const active = pendingRef.current;
    if (!active) {
      return;
    }

    if (active.key === currentKey) {
      if (active.source === 'passive' || active.source === 'history') {
        return;
      }
      finalizeSpan(active, undefined, { status: 'completed', source: 'navigation', reason: active.reason });
      pendingRef.current = null;
      return;
    }

    if (navigation.state === 'idle' && active.source === 'navigation') {
      finalizeSpan(active, undefined, { status: 'aborted', source: 'navigation', reason: active.reason });
      pendingRef.current = null;
    }
  }, [currentKey, navigation.state]);

  useEffect(() => () => {
    if (!pendingRef.current) return;
    const span = pendingRef.current;
    pendingRef.current = null;
    finalizeSpan(span, undefined, { status: 'unmounted', source: span.source, reason: span.reason });
  }, []);

  return (
    <RouteHydrationErrorContext.Provider value={handleRouteError}>
      {children ?? null}
    </RouteHydrationErrorContext.Provider>
  );
};

export default RouteHydrationListener;

type RouteHydrationErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

type RouteHydrationErrorBoundaryState = {
  hasError: boolean;
};

type RouteHydrationErrorBoundaryInnerProps = RouteHydrationErrorBoundaryProps & {
  onError: HydrationErrorHandler;
};

class RouteHydrationErrorBoundaryInner extends React.Component<
  RouteHydrationErrorBoundaryInnerProps,
  RouteHydrationErrorBoundaryState
> {
  state: RouteHydrationErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RouteHydrationErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    this.props.onError(error);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div role="alert" style={{ padding: '1rem', fontSize: '0.875rem' }}>
          コンテンツの読み込みに失敗しました。
        </div>
      );
    }
    return this.props.children;
  }
}

export const RouteHydrationErrorBoundary: React.FC<RouteHydrationErrorBoundaryProps> = ({
  children,
  fallback,
}) => {
  const handleError = useRouteHydrationErrorHandler();
  const location = useLocation();
  const resetKey = `${location.pathname}|${location.search}|${location.hash}`;

  return (
    <RouteHydrationErrorBoundaryInner key={resetKey} onError={handleError} fallback={fallback}>
      {children}
    </RouteHydrationErrorBoundaryInner>
  );
};
