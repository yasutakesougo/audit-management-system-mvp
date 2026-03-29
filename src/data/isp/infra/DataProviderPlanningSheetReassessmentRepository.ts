import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { 
  resolveInternalNamesDetailed, 
  areEssentialFieldsResolved 
} from '@/lib/sp/resolveInternalNames';
import { reportResourceResolution } from '@/lib/data/dataProviderObservabilityStore';
import type { PlanningSheetReassessment } from '@/domain/isp/planningSheetReassessment';
import type { PlanningSheetReassessmentRepository } from '@/domain/isp/port';
import { 
  PLANNING_SHEET_REASSESSMENT_FIELDS, 
  PLANNING_SHEET_REASSESSMENT_LIST_TITLE, 
  PLANNING_SHEET_REASSESSMENT_SELECT_FIELDS,
  REASSESSMENT_CANDIDATES,
  REASSESSMENT_ESSENTIALS,
  type SpPlanningSheetReassessmentRow 
} from '@/sharepoint/fields/pdcaCycleFields';
import { SP_QUERY_LIMITS } from '@/shared/api/spQueryLimits';

/**
 * DataProviderPlanningSheetReassessmentRepository
 */
export class DataProviderPlanningSheetReassessmentRepository implements PlanningSheetReassessmentRepository {
  private resolution: { title: string; fields: Record<string, string | undefined> } | null = null;

  constructor(
    private readonly provider: IDataProvider,
    private readonly listTitle: string = PLANNING_SHEET_REASSESSMENT_LIST_TITLE
  ) {}

  private async resolveSource() {
    if (this.resolution) return this.resolution;

    try {
      const available = await this.provider.getFieldInternalNames(this.listTitle);
      const { resolved, fieldStatus } = resolveInternalNamesDetailed(available, REASSESSMENT_CANDIDATES as unknown as Record<string, string[]>);

      const isHealthy = areEssentialFieldsResolved(resolved, REASSESSMENT_ESSENTIALS as unknown as string[]);
      
      reportResourceResolution({
        resourceName: 'PlanningSheetReassessment',
        resolvedTitle: this.listTitle,
        fieldStatus: fieldStatus as Record<string, { resolvedName?: string; candidates: string[] }>,
        essentials: REASSESSMENT_ESSENTIALS as unknown as string[],
      });

      if (!isHealthy) {
        console.warn(`[DataProviderPlanningSheetReassessmentRepository] Essential fields missing in ${this.listTitle}.`);
      }

      this.resolution = { 
        title: this.listTitle, 
        fields: resolved as Record<string, string | undefined> 
      };
      return this.resolution;
    } catch (error) {
      reportResourceResolution({
        resourceName: 'PlanningSheetReassessment',
        resolvedTitle: this.listTitle,
        fieldStatus: {},
        essentials: REASSESSMENT_ESSENTIALS as unknown as string[],
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
  }): Promise<PlanningSheetReassessment[]> {
    const { title, fields } = await this.resolveSource();
    const sheetField = fields.planningSheetId || 'PlanningSheetId';
    const userField = fields.userId || 'UserId';
    
    // OData エスケープ
    const escapedSheetId = planningSheetId.replace(/'/g, "''");
    const escapedUserId = userId.replace(/'/g, "''");

    const filter = `${sheetField} eq '${escapedSheetId}' and ${userField} eq '${escapedUserId}'`;

    const rows = await this.provider.listItems<SpPlanningSheetReassessmentRow>(title, {
      select: Array.from(PLANNING_SHEET_REASSESSMENT_SELECT_FIELDS),
      filter,
      orderby: `${PLANNING_SHEET_REASSESSMENT_FIELDS.reassessmentDate} desc`,
      top: SP_QUERY_LIMITS.default,
    });

    return rows.map(row => this.mapRowToDomain(row));
  }

  private mapRowToDomain(row: SpPlanningSheetReassessmentRow): PlanningSheetReassessment {
    return {
      id: `sp-${row.Id ?? ''}`,
      planningSheetId: String(row.PlanningSheetId ?? ''),
      reassessedAt: String(row.ReassessmentDate ?? ''),
      reassessedBy: String(row.ReassessedBy ?? ''),
      triggerType: (row.ReassessmentTrigger ?? 'scheduled') as unknown as 'scheduled',
      abcSummary: String(row.AbcSummary ?? ''),
      hypothesisReview: String(row.HypothesisReview ?? ''),
      procedureEffectiveness: String(row.ProcedureEffectiveness ?? ''),
      environmentChange: String(row.EnvironmentChange ?? ''),
      planChangeDecision: String(row.PlanChangeDecision ?? 'none') as unknown as 'no_change',
      nextReassessmentAt: String(row.NextReassessmentAt ?? ''),
      notes: String(row.Notes ?? ''),
    };
  }
}
