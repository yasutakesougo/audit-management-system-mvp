/**
 * useDailySupportUserFilter — /daily/support 用ユーザーフィルターフック
 *
 * IUserMaster[] を受け取り、3条件でフィルタリングした結果を返す。
 * - 支援区分 (DisabilitySupportLevel)
 * - ステータス (UsageStatus / IsActive)
 * - 強度行動障害支援対象者 (IsHighIntensitySupportTarget)
 */
import type { IUserMaster } from '@/features/users/types';
import { USAGE_STATUS_VALUES } from '@/features/users/typesExtended';
import { useCallback, useMemo, useState } from 'react';

export type DailySupportUserFilter = {
  /** 支援区分 ('' = 全て) */
  supportLevel: string;
  /** 利用ステータス ('' = 全て, 'active' | 'suspended' | 'terminated' | 'pending') */
  usageStatus: string;
  /** 強度行動障害支援対象者のみ */
  highIntensityOnly: boolean;
};

const DEFAULT_FILTER: DailySupportUserFilter = {
  supportLevel: '',
  usageStatus: '',
  highIntensityOnly: false,
};

function resolveEffectiveStatus(user: IUserMaster): string {
  if (user.UsageStatus === USAGE_STATUS_VALUES.TERMINATED) return 'terminated';
  if (user.UsageStatus === USAGE_STATUS_VALUES.SUSPENDED || user.IsActive === false) return 'suspended';
  if (user.UsageStatus === USAGE_STATUS_VALUES.PENDING) return 'pending';
  return 'active';
}

export function useDailySupportUserFilter(users: IUserMaster[]) {
  const [filter, setFilter] = useState<DailySupportUserFilter>(DEFAULT_FILTER);

  const filteredUsers = useMemo(() => {
    let result = users;

    // 支援区分フィルター
    if (filter.supportLevel) {
      result = result.filter(
        (u) => u.DisabilitySupportLevel === filter.supportLevel,
      );
    }

    // ステータスフィルター
    if (filter.usageStatus) {
      result = result.filter(
        (u) => resolveEffectiveStatus(u) === filter.usageStatus,
      );
    }

    // 強度行動障害対象者フィルター
    if (filter.highIntensityOnly) {
      result = result.filter((u) => u.IsHighIntensitySupportTarget === true);
    }

    return result;
  }, [users, filter]);

  const updateFilter = useCallback(
    (patch: Partial<DailySupportUserFilter>) =>
      setFilter((prev) => ({ ...prev, ...patch })),
    [],
  );

  const resetFilter = useCallback(() => setFilter(DEFAULT_FILTER), []);

  const hasActiveFilter =
    filter.supportLevel !== '' ||
    filter.usageStatus !== '' ||
    filter.highIntensityOnly;

  return {
    filter,
    updateFilter,
    resetFilter,
    filteredUsers,
    hasActiveFilter,
  } as const;
}
