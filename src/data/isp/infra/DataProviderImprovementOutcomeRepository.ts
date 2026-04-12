import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { areEssentialFieldsResolved, resolveInternalNamesDetailed } from '@/lib/sp/helpers';
import type { ImprovementOutcome } from '@/domain/isp/improvementOutcome';
import type { ImprovementOutcomeRepository } from '@/domain/isp/improvementOutcomeRepository';
import {
  IMPROVEMENT_OUTCOME_CANDIDATES,
  IMPROVEMENT_OUTCOME_ENSURE_FIELDS,
  IMPROVEMENT_OUTCOME_ESSENTIALS,
  type ImprovementOutcomeCandidateKey,
  type ImprovementOutcomeFieldMapping,
  type SpImprovementOutcomeRow,
} from '@/sharepoint/fields/improvementOutcomeFields';

const LIST_TITLE = 'ImprovementOutcomes';

export class DataProviderImprovementOutcomeRepository
  implements ImprovementOutcomeRepository {
  private resolution: { listTitle: string; mapping: ImprovementOutcomeFieldMapping } | null = null;

  constructor(
    private readonly provider: IDataProvider,
    private readonly listTitle: string = LIST_TITLE,
  ) {}

  private mf(mapping: ImprovementOutcomeFieldMapping, key: ImprovementOutcomeCandidateKey): string {
    return mapping[key] ?? IMPROVEMENT_OUTCOME_CANDIDATES[key][0];
  }

  private async resolveSource(): Promise<{ listTitle: string; mapping: ImprovementOutcomeFieldMapping }> {
    if (this.resolution) return this.resolution;

    await this.provider.ensureListExists(
      this.listTitle,
      [...IMPROVEMENT_OUTCOME_ENSURE_FIELDS] as unknown as Parameters<IDataProvider['ensureListExists']>[1],
    );

    const available = await this.provider.getFieldInternalNames(this.listTitle);
    const { resolved } = resolveInternalNamesDetailed(
      available,
      IMPROVEMENT_OUTCOME_CANDIDATES as unknown as Record<string, string[]>,
    );

    const isHealthy = areEssentialFieldsResolved(
      resolved,
      IMPROVEMENT_OUTCOME_ESSENTIALS as unknown as string[],
    );

    if (!isHealthy) {
      throw new Error(`ImprovementOutcome schema could not be resolved: ${this.listTitle}`);
    }

    this.resolution = {
      listTitle: this.listTitle,
      mapping: resolved as ImprovementOutcomeFieldMapping,
    };
    return this.resolution;
  }

  private mapRow(row: SpImprovementOutcomeRow, mapping: ImprovementOutcomeFieldMapping): ImprovementOutcome {
    return {
      id: String(row[this.mf(mapping, 'outcomeId')] ?? ''),
      planningSheetId: String(row[this.mf(mapping, 'planningSheetId')] ?? ''),
      patchId: String(row[this.mf(mapping, 'patchId')] ?? ''),
      observedAt: String(row[this.mf(mapping, 'observedAt')] ?? ''),
      targetMetric: String(row[this.mf(mapping, 'targetMetric')] ?? 'incident_count') as ImprovementOutcome['targetMetric'],
      source: String(row[this.mf(mapping, 'source')] ?? 'manual_kpi') as ImprovementOutcome['source'],
      metricDefinitionId: String(row[this.mf(mapping, 'metricDefinitionId')] ?? '') || undefined,
      beforeValue: Number(row[this.mf(mapping, 'beforeValue')] ?? 0),
      afterValue: Number(row[this.mf(mapping, 'afterValue')] ?? 0),
      changeRate: Number(row[this.mf(mapping, 'changeRate')] ?? 0),
      isImproved: Boolean(row[this.mf(mapping, 'isImproved')]),
      confidence: String(row[this.mf(mapping, 'confidence')] ?? 'medium') as ImprovementOutcome['confidence'],
      evaluationWindowDays: row[this.mf(mapping, 'evaluationWindowDays')] == null
        ? undefined
        : Number(row[this.mf(mapping, 'evaluationWindowDays')]),
      createdAt: String(row[this.mf(mapping, 'createdAt')] ?? ''),
    };
  }

  private buildPayload(
    outcome: ImprovementOutcome,
    mapping: ImprovementOutcomeFieldMapping,
  ): Record<string, unknown> {
    return {
      Title: outcome.id,
      [this.mf(mapping, 'outcomeId')]: outcome.id,
      [this.mf(mapping, 'planningSheetId')]: outcome.planningSheetId,
      [this.mf(mapping, 'patchId')]: outcome.patchId,
      [this.mf(mapping, 'observedAt')]: outcome.observedAt,
      [this.mf(mapping, 'targetMetric')]: outcome.targetMetric,
      [this.mf(mapping, 'source')]: outcome.source,
      [this.mf(mapping, 'metricDefinitionId')]: outcome.metricDefinitionId ?? null,
      [this.mf(mapping, 'beforeValue')]: outcome.beforeValue,
      [this.mf(mapping, 'afterValue')]: outcome.afterValue,
      [this.mf(mapping, 'changeRate')]: outcome.changeRate,
      [this.mf(mapping, 'isImproved')]: outcome.isImproved,
      [this.mf(mapping, 'confidence')]: outcome.confidence,
      [this.mf(mapping, 'evaluationWindowDays')]: outcome.evaluationWindowDays ?? null,
      [this.mf(mapping, 'createdAt')]: outcome.createdAt,
    };
  }

  async save(outcome: ImprovementOutcome): Promise<void> {
    const { listTitle, mapping } = await this.resolveSource();
    await this.provider.createItem(listTitle, this.buildPayload(outcome, mapping));
  }

  async findByPlanningSheetId(planningSheetId: string): Promise<ImprovementOutcome[]> {
    const { listTitle, mapping } = await this.resolveSource();
    const rows = await this.provider.listItems<SpImprovementOutcomeRow>(listTitle, {
      filter: `${this.mf(mapping, 'planningSheetId')} eq '${planningSheetId.replace(/'/g, "''")}'`,
      orderby: `${this.mf(mapping, 'observedAt')} desc`,
      top: 200,
    });
    return rows.map((row) => this.mapRow(row, mapping));
  }

  async findByPatchId(patchId: string): Promise<ImprovementOutcome[]> {
    const { listTitle, mapping } = await this.resolveSource();
    const rows = await this.provider.listItems<SpImprovementOutcomeRow>(listTitle, {
      filter: `${this.mf(mapping, 'patchId')} eq '${patchId.replace(/'/g, "''")}'`,
      orderby: `${this.mf(mapping, 'observedAt')} desc`,
      top: 200,
    });
    return rows.map((row) => this.mapRow(row, mapping));
  }
}
