import * as React from 'react';
import { Navigate } from 'react-router-dom';
import { useFeatureFlag } from '@/config/featureFlags';
import { canAccessDashboardAudience, useAuthStore } from '@/features/auth/store';

type Props = { children: React.ReactNode; requireEdit?: boolean };

export const IcebergPdcaGate: React.FC<Props> = ({ children, requireEdit }) => {
  const icebergPdca = useFeatureFlag('icebergPdca');
  const role = useAuthStore((s) => s.currentUserRole); // 'staff' | 'admin'

  const canView = icebergPdca;
  const canEdit = icebergPdca && canAccessDashboardAudience(role, 'admin');

  if (!canView) return <Navigate to="/analysis" replace />;
  if (requireEdit && !canEdit) return <Navigate to="/analysis/iceberg-pdca" replace />;

  return <>{children}</>;
};
