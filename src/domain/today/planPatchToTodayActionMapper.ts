import type { PlanPatch } from '@/domain/isp/planPatch';
import { isPlanPatchOverdue } from '@/domain/isp/planPatch';
import type { RawActionSource } from '@/features/today/domain/models/queue.types';

type PlanPatchActionContext = {
  patch: PlanPatch;
  userId: string;
  userName?: string;
};

function toTargetTime(dueAt?: string): Date | undefined {
  const dateOnly = dueAt?.slice(0, 10);
  if (!dateOnly) return undefined;

  const target = new Date(`${dateOnly}T09:00:00`);
  return Number.isNaN(target.getTime()) ? undefined : target;
}

export function mapPlanPatchToTodayActionSource({
  patch,
  userId,
  userName,
}: PlanPatchActionContext): RawActionSource {
  const displayName = userName?.trim() || userId;
  const overdue = isPlanPatchOverdue(patch);

  return {
    id: `today-plan-patch-${patch.id}`,
    sourceType: 'plan_patch',
    title: overdue
      ? `【更新期限超過】${displayName} さんの支援計画を確認`
      : `【計画更新】${displayName} さんの支援計画を確認`,
    targetTime: toTargetTime(patch.dueAt),
    slaMinutes: 0,
    isCompleted: patch.status === 'confirmed',
    payload: {
      patchId: patch.id,
      planningSheetId: patch.planningSheetId,
      userId,
      userName: displayName,
      status: patch.status,
      reason: patch.reason,
      dueAt: patch.dueAt,
      evidenceIds: patch.evidenceIds,
      path: `/support-planning-sheet/${patch.planningSheetId}?tab=planning`,
    },
  };
}

export function mapPlanPatchesToTodayActionSources(
  patches: PlanPatchActionContext[],
): RawActionSource[] {
  return patches.map(mapPlanPatchToTodayActionSource);
}
