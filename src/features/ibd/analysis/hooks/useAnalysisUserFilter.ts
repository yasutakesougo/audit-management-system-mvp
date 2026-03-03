import { useUsersStore } from '@/features/users/store';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type UserOption = { id: string; label: string };

/**
 * 分析ワークスペース全タブで共有する利用者フィルター
 * searchParams ベースで `userId` を管理し、タブ切替でも状態が消えない。
 */
export function useAnalysisUserFilter() {
  const { data: users = [], status: usersStatus } = useUsersStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const userOptions: UserOption[] = useMemo(
    () =>
      users
        .filter((u) => (u.IsActive ?? true) && (u.FullName ?? '').trim().length > 0)
        .map((u) => ({
          id: u.UserID ?? String(u.Id),
          label: u.FullName ?? '',
        })),
    [users],
  );

  const selectedUserId = searchParams.get('userId') ?? undefined;

  const selectedOption = useMemo(
    () => userOptions.find((opt) => opt.id === selectedUserId) ?? null,
    [selectedUserId, userOptions],
  );

  const handleUserChange = (_: unknown, option: UserOption | null) => {
    const next = new URLSearchParams(searchParams);
    if (option?.id) {
      next.set('userId', option.id);
    } else {
      next.delete('userId');
    }
    setSearchParams(next, { replace: true });
  };

  const targetUserIds = useMemo(
    () =>
      selectedUserId
        ? [selectedUserId]
        : users.filter((u) => u.IsActive !== false).map((u) => u.UserID ?? String(u.Id)),
    [selectedUserId, users],
  );

  return {
    users,
    usersStatus,
    userOptions,
    selectedUserId,
    selectedOption,
    handleUserChange,
    targetUserIds,
  };
}
