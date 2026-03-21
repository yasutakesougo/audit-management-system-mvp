import type { PlanningSheetReassessmentRepository } from '@/domain/isp/port';
import type { PlanningSheetReassessment } from '@/domain/isp/planningSheetReassessment';

export class InMemoryPlanningSheetReassessmentRepository
  implements PlanningSheetReassessmentRepository
{
  constructor(private records: PlanningSheetReassessment[] = []) {}

  setRecords(records: PlanningSheetReassessment[]): void {
    this.records = [...records];
  }

  async findByPlanningSheetId(params: {
    planningSheetId: string;
  }): Promise<PlanningSheetReassessment[]> {
    const { planningSheetId } = params;

    return this.records
      .filter((record) => record.planningSheetId === planningSheetId)
      .sort((a, b) => b.reassessedAt.localeCompare(a.reassessedAt));
  }
}
