/**
 * createSuspended — React.lazy コンポーネントを Suspense + ErrorBoundary でラップするヘルパー
 *
 * router.tsx にあった 30+ の Suspended* ラッパーを 1 行で生成。
 */
import { RouteHydrationErrorBoundary } from '@/hydration/RouteHydrationListener';
import React from 'react';

const DEFAULT_LOADING_CLASS = 'p-4 text-sm text-slate-600';

/**
 * React.lazy コンポーネントを Suspense + RouteHydrationErrorBoundary でラップ。
 *
 * @example
 * const SuspendedDailyRecordPage = createSuspended(DailyRecordPage, '記録を読み込んでいます…');
 */
export function createSuspended(
  LazyComponent: React.LazyExoticComponent<React.ComponentType<object>>,
  loadingMessage = '読み込んでいます…',
): React.FC {
  const Wrapped: React.FC = () => (
    <RouteHydrationErrorBoundary>
      <React.Suspense
        fallback={
          <div className={DEFAULT_LOADING_CLASS} role="status">
            {loadingMessage}
          </div>
        }
      >
        <LazyComponent />
      </React.Suspense>
    </RouteHydrationErrorBoundary>
  );
  Wrapped.displayName = `Suspended(${loadingMessage.slice(0, 20)})`;
  return Wrapped;
}
