import type { PlanPatch } from '@/domain/isp/planPatch';
import type { PlanPatchRepository } from '@/domain/isp/planPatchRepository';

const STORAGE_KEY = 'isp.plan-patches.v1';
const MAX_PATCHES = 500;

function readStore(): PlanPatch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PlanPatch[];
  } catch {
    return [];
  }
}

function writeStore(patches: PlanPatch[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patches));
}

export const localPlanPatchRepository: PlanPatchRepository = {
  async save(patch: PlanPatch): Promise<void> {
    const all = readStore();
    const existingIndex = all.findIndex((item) => item.id === patch.id);

    if (existingIndex >= 0) {
      all[existingIndex] = {
        ...all[existingIndex],
        ...patch,
        updatedAt: new Date().toISOString(),
      };
    } else {
      all.unshift(patch);
      if (all.length > MAX_PATCHES) {
        all.length = MAX_PATCHES;
      }
    }

    writeStore(all);
  },

  async findByPlanningSheetId(planningSheetId: string): Promise<PlanPatch[]> {
    return readStore().filter((patch) => patch.planningSheetId === planningSheetId);
  },

  async updateStatus(patchId: string, status: PlanPatch['status']): Promise<void> {
    const all = readStore();
    const index = all.findIndex((patch) => patch.id === patchId);
    if (index < 0) return;

    all[index] = {
      ...all[index],
      status,
      updatedAt: new Date().toISOString(),
    };
    writeStore(all);
  },

  async findPending(planningSheetId: string): Promise<PlanPatch[]> {
    return readStore().filter(
      (patch) => patch.planningSheetId === planningSheetId && patch.status !== 'confirmed',
    );
  },
};
