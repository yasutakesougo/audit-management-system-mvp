import { useFeatureFlag, type FeatureFlagSnapshot } from '@/config/featureFlags';
import { isE2E } from '@/env';
import { type ReactElement } from 'react';
import { Navigate, type NavigateProps } from 'react-router-dom';

export type ProtectedRouteProps = {
  flag: keyof FeatureFlagSnapshot;
  children: ReactElement;
  fallbackPath?: NavigateProps['to'];
};

/**
 * Development-only debug logging to avoid production noise
 */
const debug = (...args: unknown[]) => {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[ProtectedRoute]', ...args);
  }
};

/**
 * Determine if a feature flag should be bypassed in E2E environment.
 * Critical flags that need E2E testing should return false.
 */
const shouldBypassInE2E = (flag: keyof FeatureFlagSnapshot): boolean => {
  // These flags require proper E2E testing of access control
  const criticalFlags: (keyof FeatureFlagSnapshot)[] = [
    // 'schedules', // Uncomment if schedule access control needs E2E testing
    // 'schedulesCreate', // Uncomment if creation control needs E2E testing
  ];

  return !criticalFlags.includes(flag);
};

export default function ProtectedRoute({ flag, children, fallbackPath = '/' }: ProtectedRouteProps) {
  const enabled = useFeatureFlag(flag);

  // E2E環境では、重要でないフラグは bypass して画面テストを優先
  if (isE2E && shouldBypassInE2E(flag)) {
    debug('E2E bypass enabled for flag:', flag);
    return children;
  }

  if (enabled) {
    debug('Access granted for flag:', flag);
    return children;
  }

  debug('Access denied for flag:', flag, '- redirecting to', fallbackPath);
  return <Navigate to={fallbackPath} replace />;
}
