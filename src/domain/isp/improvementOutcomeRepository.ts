import type { ImprovementOutcome } from './improvementOutcome';

export interface ImprovementOutcomeRepository {
  save(outcome: ImprovementOutcome): Promise<void>;
  findByPlanningSheetId(planningSheetId: string): Promise<ImprovementOutcome[]>;
  findByPatchId(patchId: string): Promise<ImprovementOutcome[]>;
}
