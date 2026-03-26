import { useEffect, useRef } from 'react';

export type UseKioskAutoRefreshOptions = {
  enabled: boolean;
  intervalMs?: number;
  onRefresh: () => void | Promise<void>;
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
}: UseKioskAutoRefreshOptions): void {
  const refreshRef = useRef(onRefresh);

  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof document === 'undefined') return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const runRefresh = () => {
      void Promise.resolve(refreshRef.current()).catch(() => {});
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
          runRefresh();
        }
      }, intervalMs);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stop();
        return;
      }
      runRefresh();
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

