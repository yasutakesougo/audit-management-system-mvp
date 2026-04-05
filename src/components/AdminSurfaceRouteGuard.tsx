import React from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Navigate, useLocation } from 'react-router-dom';

import { canAccess, type Role } from '@/auth/roles';
import { useUserAuthz } from '@/auth/useUserAuthz';
import { isAdminSurfacePath } from '@/features/admin/config/adminSurfaces';

type AdminSurfaceRouteGuardProps = {
  children: React.ReactNode;
  minimumRole?: Role;
  redirectTo?: string;
};

export default function AdminSurfaceRouteGuard({
  children,
  minimumRole = 'reception',
  redirectTo = '/today',
}: AdminSurfaceRouteGuardProps) {
  const location = useLocation();
  const { role, ready } = useUserAuthz();

  if (!isAdminSurfacePath(location.pathname)) {
    return <>{children}</>;
  }

  if (!ready) {
    return (
      <Stack
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          p: 2,
        }}
      >
        <Typography variant="body1">権限を確認中...</Typography>
      </Stack>
    );
  }

  if (!canAccess(role, minimumRole)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
