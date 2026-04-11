import { mapPlanPatchesToTodayActionSources } from '@/domain/today/planPatchToTodayActionMapper';
import type { RawActionSource } from '@/features/today/domain/models/queue.types';
import { usePlanPatchRepository } from '@/features/planning-sheet/hooks/usePlanPatchRepository';
import { usePlanningSheetRepositories } from '@/features/planning-sheet/hooks/usePlanningSheetRepositories';
import type { IUserMaster } from '@/features/users/types';
import { useEffect, useMemo, useState } from 'react';

function resolveUserId(user: IUserMaster): string {
  const userId = String(user.UserID ?? '').trim();
  return userId || `U${String(user.Id ?? 0).padStart(3, '0')}`;
}

export function useTodayPlanPatchActions(users: IUserMaster[]): RawActionSource[] {
  const planningSheetRepository = usePlanningSheetRepositories();
  const planPatchRepository = usePlanPatchRepository();
  const [actions, setActions] = useState<RawActionSource[]>([]);

  const targetUsers = useMemo(
    () => users.filter((user) => user.IsHighIntensitySupportTarget === true),
    [users],
  );

  useEffect(() => {
    let active = true;

    async function load(): Promise<void> {
      if (targetUsers.length === 0) {
        if (active) setActions([]);
        return;
      }

      const collected = await Promise.all(
        targetUsers.map(async (user) => {
          const userId = resolveUserId(user);
          const sheets = await planningSheetRepository.listCurrentByUser(userId);
          if (sheets.length === 0) return [];

          const pendingGroups = await Promise.all(
            sheets.map((sheet) => planPatchRepository.findPending(sheet.id)),
          );

          return mapPlanPatchesToTodayActionSources(
            pendingGroups
              .flat()
              .filter((patch) => patch.status !== 'confirmed')
              .map((patch) => ({
                patch,
                userId,
                userName: user.FullName ?? userId,
              })),
          );
        }),
      );

      if (active) {
        setActions(collected.flat());
      }
    }

    void load().catch(() => {
      if (active) {
        setActions([]);
      }
    });

    return () => {
      active = false;
    };
  }, [planPatchRepository, planningSheetRepository, targetUsers]);

  return actions;
}
