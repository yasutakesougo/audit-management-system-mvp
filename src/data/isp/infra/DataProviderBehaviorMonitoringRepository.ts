import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { 
  resolveInternalNamesDetailed, 
  areEssentialFieldsResolved 
} from '@/lib/sp/resolveInternalNames';
import { reportResourceResolution } from '@/lib/data/dataProviderObservabilityStore';
import type { 
  BehaviorMonitoringRecord, 
  BehaviorAchievementLevel,
  SupportMethodEvaluation,
  EnvironmentFinding
} from '@/domain/isp/behaviorMonitoring';
import type { BehaviorMonitoringRepository } from '@/domain/isp/port';
import { 
  BEHAVIOR_MONITORING_FIELDS, 
  BEHAVIOR_MONITORING_LIST_TITLE, 
  BEHAVIOR_MONITORING_SELECT_FIELDS,
  BEHAVIOR_MONITORING_CANDIDATES,
  BEHAVIOR_MONITORING_ESSENTIALS,
  safeJsonParse,
  type SpBehaviorMonitoringRow 
} from '@/sharepoint/fields/pdcaCycleFields';
import { z } from 'zod';
import { SP_QUERY_LIMITS } from '@/shared/api/spQueryLimits';

const behaviorAchievementSchema = z.enum([
  'effective',
  'mostly_effective',
  'partial',
  'not_effective',
  'not_observed',
]);

const supportMethodEvaluationSchema = z.object({
  methodDescription: z.string(),
  achievementLevel: behaviorAchievementSchema,
  comment: z.string(),
});

const environmentFindingSchema = z.object({
  adjustment: z.string(),
  wasEffective: z.boolean(),
  comment: z.string(),
});

const behaviorMonitoringRecordSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  planningSheetId: z.string().min(1),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  supportEvaluations: z.array(supportMethodEvaluationSchema),
  environmentFindings: z.array(environmentFindingSchema),
  effectiveSupports: z.string(),
  difficultiesObserved: z.string(),
  newTriggers: z.array(z.string()),
  medicalSafetyNotes: z.string(),
  userFeedback: z.string(),
  familyFeedback: z.string(),
  recommendedChanges: z.array(z.string()),
  summary: z.string(),
  recordedBy: z.string(),
  recordedAt: z.string().min(1),
});

/**
 * DataProviderBehaviorMonitoringRepository
 */
export class DataProviderBehaviorMonitoringRepository implements BehaviorMonitoringRepository {
  private resolution: { title: string; fields: Record<string, string | undefined> } | null = null;

  constructor(
    private readonly provider: IDataProvider,
    private readonly listTitle: string = BEHAVIOR_MONITORING_LIST_TITLE
  ) {}

  private async resolveSource() {
    if (this.resolution) return this.resolution;

    try {
      const available = await this.provider.getFieldInternalNames(this.listTitle);
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, BEHAVIOR_MONITORING_CANDIDATES as unknown as Record<string, string[]>);

      const isHealthy = areEssentialFieldsResolved(resolved, BEHAVIOR_MONITORING_ESSENTIALS as unknown as string[]);
      
      reportResourceResolution({
        resourceName: 'BehaviorMonitoring',
        resolvedTitle: this.listTitle,
        fieldStatus: fieldStatus as Record<string, { resolvedName?: string; candidates: string[] }>,
        essentials: BEHAVIOR_MONITORING_ESSENTIALS as unknown as string[],
      });

      if (!isHealthy) {
        console.warn(`[DataProviderBehaviorMonitoringRepository] Essential fields missing in ${this.listTitle}.`);
      }

      this.resolution = { 
        title: this.listTitle, 
        fields: resolved as Record<string, string | undefined> 
      };
      return this.resolution;
    } catch (error) {
      reportResourceResolution({
        resourceName: 'BehaviorMonitoring',
        resolvedTitle: this.listTitle,
        fieldStatus: {},
        essentials: BEHAVIOR_MONITORING_ESSENTIALS as unknown as string[],
        error: String(error)
      });
      throw error;
    }
  }

  async findByPlanningSheetId({
    planningSheetId,
    userId,
  }: {
    planningSheetId: string;
    userId: string;
  }): Promise<BehaviorMonitoringRecord[]> {
    const { title, fields } = await this.resolveSource();
    const sheetField = fields.planningSheetId || 'PlanningSheetId';
    const userField = fields.userId || 'UserId';
    
    // OData エスケープ
    const escapedSheetId = planningSheetId.replace(/'/g, "''");
    const escapedUserId = userId.replace(/'/g, "''");

    const filter = `${sheetField} eq '${escapedSheetId}' and ${userField} eq '${escapedUserId}'`;

    const rows = await this.provider.listItems<SpBehaviorMonitoringRow>(title, {
      select: Array.from(BEHAVIOR_MONITORING_SELECT_FIELDS),
      filter,
      orderby: `${BEHAVIOR_MONITORING_FIELDS.periodEnd} desc, ${BEHAVIOR_MONITORING_FIELDS.recordedAt} desc`,
      top: SP_QUERY_LIMITS.default,
    });

    return rows.map(row => this.mapRowToDomain(row));
  }

  private mapRowToDomain(row: SpBehaviorMonitoringRow): BehaviorMonitoringRecord {
    const mapped = {
      id: `sp-${row.Id ?? ''}`,
      userId: String(row.UserId ?? ''),
      planningSheetId: String(row.PlanningSheetId ?? ''),
      periodStart: String(row.PeriodStart ?? ''),
      periodEnd: String(row.PeriodEnd ?? ''),
      supportEvaluations: this.toSupportEvaluations(row.SupportEvaluationsJson),
      environmentFindings: this.toEnvironmentFindings(row.EnvironmentFindingsJson),
      effectiveSupports: String(row.EffectiveSupports ?? ''),
      difficultiesObserved: String(row.DifficultiesObserved ?? ''),
      newTriggers: this.toStringArray(row.NewTriggersJson),
      medicalSafetyNotes: String(row.MedicalSafetyNotes ?? ''),
      userFeedback: String(row.UserFeedback ?? ''),
      familyFeedback: String(row.FamilyFeedback ?? ''),
      recommendedChanges: this.toStringArray(row.RecommendedChangesJson),
      summary: String(row.Summary ?? ''),
      recordedBy: String(row.RecordedBy ?? ''),
      recordedAt: String(row.RecordedAt ?? row.Created ?? ''),
    };

    const result = behaviorMonitoringRecordSchema.safeParse(mapped);
    if (!result.success) {
      console.warn(`[DataProviderBehaviorMonitoringRepository] Invalid row data (Id=${row.Id}): ${result.error.message}`);
      // Return partially mapped if possible, or throw
      return mapped as unknown as BehaviorMonitoringRecord; 
    }

    return result.data;
  }

  private toSupportEvaluations(raw: unknown): SupportMethodEvaluation[] {
    const parsed = safeJsonParse<unknown[]>(raw, []);
    return parsed
      .map((value): SupportMethodEvaluation | null => {
        if (!value || typeof value !== 'object') return null;
        const item = value as Record<string, unknown>;
        return {
          methodDescription: String(item.methodDescription ?? ''),
          achievementLevel: this.normalizeAchievementLevel(item.achievementLevel),
          comment: String(item.comment ?? ''),
        };
      })
      .filter((item): item is SupportMethodEvaluation => item !== null);
  }

  private normalizeAchievementLevel(raw: unknown): BehaviorAchievementLevel {
    const valid: string[] = ['effective', 'mostly_effective', 'partial', 'not_effective', 'not_observed'];
    if (typeof raw === 'string' && valid.includes(raw)) return raw as BehaviorAchievementLevel;
    return 'not_observed';
  }

  private toEnvironmentFindings(raw: unknown): EnvironmentFinding[] {
    const parsed = safeJsonParse<unknown[]>(raw, []);
    return parsed
      .map((value): EnvironmentFinding | null => {
        if (!value || typeof value !== 'object') return null;
        const item = value as Record<string, unknown>;
        return {
          adjustment: String(item.adjustment ?? ''),
          wasEffective: Boolean(item.wasEffective),
          comment: String(item.comment ?? ''),
        };
      })
      .filter((item): item is EnvironmentFinding => item !== null);
  }

  private toStringArray(raw: unknown): string[] {
    const parsed = safeJsonParse<unknown[]>(raw, []);
    return parsed.map((v) => String(v));
  }
}
