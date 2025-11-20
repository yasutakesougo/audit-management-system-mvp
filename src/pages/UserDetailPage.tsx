import { UserDetailSections } from '@/features/users';
import { useUsersStore } from '@/features/users/store';
import type { IUserMaster } from '@/features/users/types';
import { demoUsers } from '@/features/users/usersStoreDemo';
import { isDemoModeEnabled, isDevMode, shouldSkipLogin } from '@/lib/env';
import Loading from '@/ui/components/Loading';
import Alert from '@mui/material/Alert';
import React, { useEffect, useMemo } from 'react';
import { useLocation, useParams } from 'react-router-dom';

// location.state の型定義を追加
type UserDetailLocationState = { user?: IUserMaster } | null;

const UserDetailPage: React.FC = () => {
  const { userId } = useParams<{ userId?: string }>();
  const location = useLocation();
  const locationState = (location.state ?? null) as UserDetailLocationState;

  // 型安全なlocation.state処理
  const fallbackUser = locationState?.user;
  const { data, status, error, refresh } = useUsersStore();

  useEffect(() => {
    if (status === 'idle') {
      void refresh();
    }
  }, [refresh, status]);

  const storeUser = useMemo(() => {
    if (!userId) return undefined;
    return data.find((item) => item.UserID === userId || String(item.Id) === userId);
  }, [data, userId]);

  const demoFallbackUser = useMemo(() => {
    if (!userId) return undefined;
    if (!shouldSkipLogin() && !isDemoModeEnabled() && !isDevMode()) {
      return undefined;
    }
    return demoUsers.find((item) => item.UserID === userId || String(item.Id) === userId);
  }, [userId]);

  const effectiveUser = storeUser ?? fallbackUser ?? demoFallbackUser;

  if (status === 'loading' && !data.length && !effectiveUser) {
    return <Loading data-testid="user-detail-loading" />;
  }

  if (!effectiveUser) {
    if (status === 'error') {
      const message = error instanceof Error ? error.message : '利用者情報の読み込みに失敗しました。';
      return <Alert severity="error" data-testid="user-detail-error">{message}</Alert>;
    }

    return (
      <Alert severity="warning" data-testid="user-not-found-warning">
        指定された利用者が見つかりません。利用者一覧から再度選択してください。
      </Alert>
    );
  }

  return (
    <UserDetailSections
      user={effectiveUser}
      backLink={{ to: '/users', label: '利用者一覧に戻る' }}
      variant="page"
      data-testid="user-detail-sections"
    />
  );
};

export default UserDetailPage;
