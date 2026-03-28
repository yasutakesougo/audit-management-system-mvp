import { useEffect, useMemo, useState } from 'react';
import {
  buildAutoTitle,
  createInitialScheduleFormState,
  type ScheduleFormState,
  type ScheduleUserOption,
} from '../../domain/scheduleFormState';

export type UseScheduleHydrationInput = {
  open: boolean;
  mode: 'create' | 'edit';
  eventId?: string;
  users: ScheduleUserOption[];
  defaultUser?: ScheduleUserOption | null;
  initialDate?: Date | string;
  initialStartTime?: string;
  initialEndTime?: string;
  initialOverride?: Partial<ScheduleFormState> | null;
};

export type ScheduleHydrationState = {
  hydrated: boolean;
  initialFormState: ScheduleFormState;
  resolvedDefaultTitle: string;
};

export function useScheduleHydrationOrchestrator(input: UseScheduleHydrationInput): ScheduleHydrationState {
  const {
    open,
    mode,
    users,
    defaultUser,
    initialDate,
    initialStartTime,
    initialEndTime,
    initialOverride,
  } = input;

  const [hydrated, setHydrated] = useState(false);

  // 1. Resolve default Title
  const resolvedDefaultTitle = useMemo(() => {
    if (initialOverride?.title?.trim()) return initialOverride.title;
    const candidateUserId = initialOverride?.userId ?? defaultUser?.id;
    const matchedUser = candidateUserId ? users.find((u) => u.id === candidateUserId) : undefined;
    if (mode === 'edit') {
      return matchedUser
        ? buildAutoTitle({
            userName: matchedUser.name,
            serviceType: initialOverride?.serviceType ?? '',
            assignedStaffId: initialOverride?.assignedStaffId ?? '',
            vehicleId: initialOverride?.vehicleId ?? '',
          })
        : '';
    }
    return buildAutoTitle({
      userName: matchedUser?.name ?? defaultUser?.name ?? undefined,
      serviceType: initialOverride?.serviceType ?? '',
      assignedStaffId: initialOverride?.assignedStaffId ?? '',
      vehicleId: initialOverride?.vehicleId ?? '',
    });
  }, [defaultUser?.id, defaultUser?.name, initialOverride, mode, users]);

  // 2. Build combined initial state
  const initialFormState = useMemo(() =>
    createInitialScheduleFormState({
      initialDate,
      initialStartTime,
      initialEndTime,
      defaultUserId: defaultUser?.id,
      defaultTitle: resolvedDefaultTitle,
      override: initialOverride ?? undefined,
    }),
    [initialDate, initialStartTime, initialEndTime, defaultUser?.id, resolvedDefaultTitle, initialOverride]
  );

  // 3. Hydration lifecycle
  useEffect(() => {
    if (open) {
      // Simulate ready state (will be expanded when real API fetching is added)
      setHydrated(true);
    } else {
      setHydrated(false);
    }
  }, [open, initialFormState]);

  return {
    hydrated,
    initialFormState,
    resolvedDefaultTitle,
  };
}
