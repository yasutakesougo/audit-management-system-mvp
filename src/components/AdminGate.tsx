import { useUserAuthz } from '@/auth/useUserAuthz';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import React from 'react';

type AdminGateProps = {
  children: React.ReactNode;
};

/**
 * AdminGate: 管理者のみアクセス可能なルート用ゲート
 *
 * - `isAdmin` が true の場合: children を表示
 * - `isAdmin` が false の場合: 403画面を表示
 * - `ready` が false の場合: ローディング状態を表示
 *
 * 3段階の防御:
 * 1. AppShell ナビゲーション → 管理者以外に非表示
 * 2. ルート自体に AdminGate ラップ → 直接URL アクセス時に 403
 * 3. useUserAuthz fail-closed ロジック → env 未設定で全員ブロック
 */
export default function AdminGate({ children }: AdminGateProps) {
  const { isAdmin, ready, reason } = useUserAuthz();
  // E2E テストモード: AdminGate を権限チェックごとスキップ
  const isTestMode = import.meta.env.VITE_E2E === '1' || import.meta.env.VITE_E2E_MSAL_MOCK === '1';
  if (isTestMode) {
    return <>{children}</>;
  }

  // 権限判定が準備中
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

  // 管理者でない場合は 403
  if (!isAdmin) {
    // 設定エラーの場合は特別なメッセージを表示
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

  // 管理者の場合は children を表示
  return <>{children}</>;
}
