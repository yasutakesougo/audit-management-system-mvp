import { type ReactElement } from 'react';
import { Navigate, type NavigateProps } from 'react-router-dom';
import { useFeatureFlag, type FeatureFlagSnapshot } from '@/config/featureFlags';

export type ProtectedRouteProps = {
  flag: keyof FeatureFlagSnapshot;
  children: ReactElement;
  fallbackPath?: NavigateProps['to'];
};

export default function ProtectedRoute({ flag, children, fallbackPath = '/' }: ProtectedRouteProps) {
  const enabled = useFeatureFlag(flag);

  if (enabled) {
    return children;
  }

  return <Navigate to={fallbackPath} replace />;
}
