import React from 'react';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useAuth } from '@/auth/useAuth';
import { useUserAuthz } from '@/auth/useUserAuthz';
import { canAccess, type Role } from '@/auth/roles';
import { readOptionalEnv, shouldSkipLogin as shouldSkipLoginEnv } from '@/lib/env';

type RequireAudienceProps = {
  requiredRole: Role;
  children: React.ReactNode;
};

export default function RequireAudience(props: RequireAudienceProps) {
  const { requiredRole, children } = props;
  const { role, ready, reason } = useUserAuthz();
  const { isAuthenticated, loading, shouldSkipLogin } = useAuth();
  const enforceAudienceInE2E = readOptionalEnv('VITE_E2E_ENFORCE_AUDIENCE') === '1';

  if (!enforceAudienceInE2E && (shouldSkipLoginEnv() || shouldSkipLogin)) {
    return <>{children}</>;
  }

  const authReady = shouldSkipLogin || (!loading && isAuthenticated);

  if (requiredRole !== 'viewer' && !ready) {
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

  if (!canAccess(role, requiredRole)) {
    const isMissingConfig = reason === 'missing-admin-group-id' && requiredRole === 'admin';
    const denialMessage =
      requiredRole === 'admin'
        ? 'このページは管理者のみアクセス可能です'
        : requiredRole === 'reception'
          ? 'このページは受付以上の権限でアクセス可能です'
          : 'このページにアクセスする権限がありません';

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
        <Paper sx={{ p: 4, maxWidth: 500 }}>
          <Stack spacing={2}>
            <Typography variant="h4" component="h1">
              {isMissingConfig ? '設定エラー' : 'アクセス権がありません'}
            </Typography>
            <Typography variant="body1" color="textSecondary">
              {isMissingConfig
                ? '管理者グループIDが未設定です（運用担当へ）'
                : denialMessage}
            </Typography>
            {isMissingConfig && (
              <Typography variant="caption" sx={{ fontFamily: 'monospace', p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                環境変数: <code>VITE_SCHEDULE_ADMINS_GROUP_ID</code>
              </Typography>
            )}
            <Typography variant="caption" color="textSecondary">
              {isMissingConfig ? '[Configuration Error]' : '[403 Forbidden]'}
            </Typography>
          </Stack>
        </Paper>
      </Stack>
    );
  }

  if (!authReady) {
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
        <Typography variant="body1">ログインを確認中...</Typography>
      </Stack>
    );
  }

  return <>{children}</>;
}
