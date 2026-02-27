import { useCallback, useMemo } from 'react';

import { useUsersStore } from '@/features/users/store';
import type { IUserMaster } from '@/features/users/types';

export type DailyUserOption = {
  id: string;
  lookupId?: number;
  label: string;
  furigana?: string | null;
  transportAdditionType?: string | null;
  mealAddition?: string | null;
};

const buildOption = (user: IUserMaster): DailyUserOption | null => {
  const rawId = (user.UserID ?? '').trim();
  const fallbackId = typeof user.Id === 'number' && Number.isFinite(user.Id)
    ? String(user.Id)
    : '';
  const id = rawId || fallbackId;
  if (!id) {
    return null;
  }

  const label = (user.FullName ?? '').trim() || `利用者 ${id}`;
  const furigana = (user.Furigana ?? user.FullNameKana ?? '')?.trim();

  return {
    id,
    lookupId: typeof user.Id === 'number' && Number.isFinite(user.Id) ? user.Id : undefined,
    label,
    furigana: furigana || null,
    transportAdditionType: user.TransportAdditionType || null,
    mealAddition: user.MealAddition || null,
  };
};

export const useDailyUserOptions = () => {
  const { data: users } = useUsersStore();

  const options = useMemo(() => {
    if (!Array.isArray(users)) {
      return [] as DailyUserOption[];
    }

    const normalized = users
      .map((user) => (user ? buildOption(user) : null))
      .filter((option): option is DailyUserOption => option != null);

    return normalized;
  }, [users]);

  const findByPersonId = useCallback(
    (personId?: string | null) => {
      if (!personId) {
        return undefined;
      }
      return options.find((option) => option.id === personId);
    },
    [options],
  );

  return {
    options,
    findByPersonId,
  };
};
