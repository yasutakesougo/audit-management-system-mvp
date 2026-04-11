import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { areEssentialFieldsResolved, resolveInternalNamesDetailed } from '@/lib/sp/helpers';
import type { PlanPatch } from '@/domain/isp/planPatch';
import type { PlanPatchRepository } from '@/domain/isp/planPatchRepository';
import {
  PLAN_PATCH_CANDIDATES,
  PLAN_PATCH_ENSURE_FIELDS,
  PLAN_PATCH_ESSENTIALS,
  type PlanPatchCandidateKey,
  type PlanPatchFieldMapping,
  type SpPlanPatchRow,
} from '@/sharepoint/fields/planPatchFields';

const LIST_TITLE = 'PlanPatches';

function parseJson<T>(value: unknown, fallback: T): T {
  if (!value || typeof value !== 'string') return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export class DataProviderPlanPatchRepository implements PlanPatchRepository {
  private resolution: { listTitle: string; mapping: PlanPatchFieldMapping } | null = null;

  constructor(
    private readonly provider: IDataProvider,
    private readonly listTitle: string = LIST_TITLE,
  ) {}

  private mf(mapping: PlanPatchFieldMapping, key: PlanPatchCandidateKey): string {
    return mapping[key] ?? PLAN_PATCH_CANDIDATES[key][0];
  }

  private async resolveSource(): Promise<{ listTitle: string; mapping: PlanPatchFieldMapping }> {
    if (this.resolution) return this.resolution;

    await this.provider.ensureListExists(
      this.listTitle,
      [...PLAN_PATCH_ENSURE_FIELDS] as unknown as Parameters<IDataProvider['ensureListExists']>[1],
    );

    const available = await this.provider.getFieldInternalNames(this.listTitle);
    const { resolved } = resolveInternalNamesDetailed(
      available,
      PLAN_PATCH_CANDIDATES as unknown as Record<string, string[]>,
    );

    const isHealthy = areEssentialFieldsResolved(
      resolved,
      PLAN_PATCH_ESSENTIALS as unknown as string[],
    );

    if (!isHealthy) {
      throw new Error(`PlanPatch schema could not be resolved: ${this.listTitle}`);
    }

    this.resolution = {
      listTitle: this.listTitle,
      mapping: resolved as PlanPatchFieldMapping,
    };
    return this.resolution;
  }

  private mapRow(row: SpPlanPatchRow, mapping: PlanPatchFieldMapping): PlanPatch {
    const target = String(row[this.mf(mapping, 'target')] ?? 'plan');
    const base = {
      id: String(row[this.mf(mapping, 'patchId')] ?? ''),
      planningSheetId: String(row[this.mf(mapping, 'planningSheetId')] ?? ''),
      baseVersion: String(row[this.mf(mapping, 'baseVersion')] ?? ''),
      reason: String(row[this.mf(mapping, 'reason')] ?? ''),
      evidenceIds: parseJson<string[]>(row[this.mf(mapping, 'evidenceIdsJson')], []),
      status: String(row[this.mf(mapping, 'status')] ?? 'draft') as PlanPatch['status'],
      dueAt: String(row[this.mf(mapping, 'dueAt')] ?? '') || undefined,
      createdAt: String(row[this.mf(mapping, 'createdAt')] ?? ''),
      updatedAt: String(row[this.mf(mapping, 'updatedAt')] ?? ''),
    };

    if (target === 'procedure') {
      return {
        ...base,
        target: 'procedure',
        before: parseJson(row[this.mf(mapping, 'beforeJson')], []),
        after: parseJson(row[this.mf(mapping, 'afterJson')], []),
      };
    }

    return {
      ...base,
      target: 'plan',
      before: parseJson(row[this.mf(mapping, 'beforeJson')], {}),
      after: parseJson(row[this.mf(mapping, 'afterJson')], {}),
    };
  }

  private buildPayload(patch: PlanPatch, mapping: PlanPatchFieldMapping): Record<string, unknown> {
    return {
      Title: `${patch.planningSheetId}_${patch.target}_${patch.status}`,
      [this.mf(mapping, 'patchId')]: patch.id,
      [this.mf(mapping, 'planningSheetId')]: patch.planningSheetId,
      [this.mf(mapping, 'target')]: patch.target,
      [this.mf(mapping, 'baseVersion')]: patch.baseVersion,
      [this.mf(mapping, 'beforeJson')]: JSON.stringify(patch.before),
      [this.mf(mapping, 'afterJson')]: JSON.stringify(patch.after),
      [this.mf(mapping, 'reason')]: patch.reason,
      [this.mf(mapping, 'evidenceIdsJson')]: JSON.stringify(patch.evidenceIds),
      [this.mf(mapping, 'status')]: patch.status,
      [this.mf(mapping, 'dueAt')]: patch.dueAt ?? null,
      [this.mf(mapping, 'createdAt')]: patch.createdAt,
      [this.mf(mapping, 'updatedAt')]: patch.updatedAt,
    };
  }

  private async findSpItemId(patchId: string, listTitle: string, mapping: PlanPatchFieldMapping): Promise<number | null> {
    const rows = await this.provider.listItems<SpPlanPatchRow>(listTitle, {
      select: ['Id'],
      filter: `${this.mf(mapping, 'patchId')} eq '${patchId.replace(/'/g, "''")}'`,
      top: 1,
    });

    const spId = rows[0]?.Id;
    return typeof spId === 'number' ? spId : null;
  }

  async save(patch: PlanPatch): Promise<void> {
    const { listTitle, mapping } = await this.resolveSource();
    const payload = this.buildPayload(patch, mapping);
    const spId = await this.findSpItemId(patch.id, listTitle, mapping);

    if (spId === null) {
      await this.provider.createItem(listTitle, payload);
      return;
    }

    await this.provider.updateItem(listTitle, spId, payload, { etag: '*' });
  }

  async findByPlanningSheetId(planningSheetId: string): Promise<PlanPatch[]> {
    const { listTitle, mapping } = await this.resolveSource();
    const rows = await this.provider.listItems<SpPlanPatchRow>(listTitle, {
      filter: `${this.mf(mapping, 'planningSheetId')} eq '${planningSheetId.replace(/'/g, "''")}'`,
      orderby: `${this.mf(mapping, 'createdAt')} desc`,
      top: 200,
    });
    return rows.map((row) => this.mapRow(row, mapping));
  }

  async updateStatus(patchId: string, status: PlanPatch['status']): Promise<void> {
    const { listTitle, mapping } = await this.resolveSource();
    const spId = await this.findSpItemId(patchId, listTitle, mapping);
    if (spId === null) return;

    await this.provider.updateItem(listTitle, spId, {
      [this.mf(mapping, 'status')]: status,
      [this.mf(mapping, 'updatedAt')]: new Date().toISOString(),
    }, { etag: '*' });
  }

  async findPending(planningSheetId: string): Promise<PlanPatch[]> {
    const patches = await this.findByPlanningSheetId(planningSheetId);
    return patches.filter((patch) => patch.status !== 'confirmed');
  }
}
