import React from 'react';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

import { useAuth } from '@/auth/useAuth';
import { useUserAuthz } from '@/auth/useUserAuthz';

export type Audience = 'staff' | 'admin';

type RequireAudienceProps = {
  audience: Audience;
  children: React.ReactNode;
};

const isTestMode =
  import.meta.env.VITE_E2E === '1' ||
  import.meta.env.VITE_E2E_MSAL_MOCK === '1' ||
  import.meta.env.VITE_SKIP_LOGIN === '1';

export default function RequireAudience({ audience, children }: RequireAudienceProps) {
  const { isAdmin, ready, reason } = useUserAuthz();
  const { isAuthenticated, loading, shouldSkipLogin } = useAuth();

  if (isTestMode || shouldSkipLogin) {
    return <>{children}</>;
  }

  const authReady = shouldSkipLogin || (!loading && isAuthenticated);

  if (audience === 'admin') {
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

    if (!isAdmin) {
      const isMissingConfig = reason === 'missing-admin-group-id';

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
                  : 'このページは管理者のみアクセス可能です'}
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

    return <>{children}</>;
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
