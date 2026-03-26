import { useEffect, useRef } from 'react';

export type UseKioskAutoRefreshOptions = {
  enabled: boolean;
  intervalMs?: number;
  onRefresh: () => void | Promise<void>;
  onVisibilityRefreshComplete?: (durationMs: number) => void;
};

/**
 * Kiosk mode polling helper.
 * - Polls on interval while page is visible.
 * - Stops polling when hidden.
 * - Immediately refreshes when visibility returns to visible.
 */
export function useKioskAutoRefresh({
  enabled,
  intervalMs = 45_000,
  onRefresh,
  onVisibilityRefreshComplete,
}: UseKioskAutoRefreshOptions): void {
  const refreshRef = useRef(onRefresh);
  const visibilityMetricRef = useRef(onVisibilityRefreshComplete);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    visibilityMetricRef.current = onVisibilityRefreshComplete;
  }, [onVisibilityRefreshComplete]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof document === 'undefined') return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const runRefresh = (reason: 'polling' | 'visibility_restore') => {
      const startedAt = performance.now();
      void Promise.resolve(refreshRef.current())
        .then(() => {
          if (reason !== 'visibility_restore') return;
          const elapsed = Math.max(0, Math.round(performance.now() - startedAt));
          visibilityMetricRef.current?.(elapsed);
        })
        .catch(() => {});
    };

    const stop = () => {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    };

    const start = () => {
      stop();
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') {
          runRefresh('polling');
        }
      }, intervalMs);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stop();
        return;
      }
      runRefresh('visibility_restore');
      start();
    };

    if (document.visibilityState === 'visible') {
      start();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, intervalMs]);
}
