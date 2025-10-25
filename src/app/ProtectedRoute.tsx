
import { type ReactElement } from 'react';
import { Navigate, type NavigateProps } from 'react-router-dom';
import { useFeatureFlag, type FeatureFlagSnapshot } from '@/config/featureFlags';
import { readBool } from '@/lib/env';

export type ProtectedRouteProps = {
  flag: keyof FeatureFlagSnapshot;
  children: ReactElement;
  fallbackPath?: NavigateProps['to'];
};

export default function ProtectedRoute({ flag, children, fallbackPath = '/' }: ProtectedRouteProps) {
  // E2E/デモ用: ログイン不要で通す
  if (readBool('VITE_SKIP_LOGIN', false)) {
    return children;
  }
  const enabled = useFeatureFlag(flag);
  if (enabled) {
    return children;
  }
  return <Navigate to={fallbackPath} replace />;
}
