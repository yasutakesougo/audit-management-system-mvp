import { useMemo } from 'react';

import { useUsersStore } from '@/features/users/store';
import type { ScheduleUserOption } from './scheduleFormState';

const normalizeUserId = (value: unknown, fallbackId?: number): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  if (typeof fallbackId === 'number' && Number.isFinite(fallbackId)) {
    return String(fallbackId).trim();
  }
  return '';
};

const normalizeUserName = (value: unknown, fallbackId: string): string => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return fallbackId ? `利用者 ${fallbackId}` : '';
};

export const useScheduleUserOptions = (): ScheduleUserOption[] => {
  const { data: users } = useUsersStore();

  return useMemo(() => {
    if (!Array.isArray(users)) {
      return [];
    }

    const normalized: ScheduleUserOption[] = [];

    for (const user of users) {
      if (!user) {
        continue;
      }
      const id = normalizeUserId(user.UserID, user.Id);
      if (!id) {
        continue;
      }
      const name = normalizeUserName(user.FullName, id);
      if (!name) {
        continue;
      }
      const lookupId = typeof user.Id === 'number' && Number.isFinite(user.Id)
        ? String(user.Id)
        : undefined;
      normalized.push({ id, name, lookupId });
    }

    return normalized;
  }, [users]);
};
