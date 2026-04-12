import type { PlanPatch } from './planPatch';

export interface PlanPatchRepository {
  save(patch: PlanPatch): Promise<void>;
  findByPlanningSheetId(planningSheetId: string): Promise<PlanPatch[]>;
  updateStatus(patchId: string, status: PlanPatch['status']): Promise<void>;
  findPending(planningSheetId: string): Promise<PlanPatch[]>;
}
