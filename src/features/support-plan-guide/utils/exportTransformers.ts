import type { SupportPlanDraft, SupportPlanForm } from '../types';
import type { SupportPlanExportModel, ExportValidationResult } from '../types/export';

/** 
 * toExportModel — Transforms a draft into a flat, document-ready model.
 */
export function toExportModel(
  draft: SupportPlanDraft,
  validation: ExportValidationResult
): SupportPlanExportModel {
  const form = draft.data;

  // Flatten goals
  const longGoals = form.goals
    .filter((g) => g.type === 'long')
    .map((g) => g.text)
    .slice(0, 2); // Map top 2 per contract v1

  const shortGoals = form.goals
    .filter((g) => g.type === 'short')
    .map((g) => g.text);

  const supportMeasures = form.goals
    .filter((g) => g.type === 'support')
    .map((g) => g.text);

  return {
    coreIsp: {
      serviceUserName: form.serviceUserName,
      supportLevel: form.supportLevel,
      planPeriod: form.planPeriod,
      attendingDays: form.attendingDays || '',
      userRole: form.userRole || '',
      assessmentSummary: form.assessmentSummary,
      decisionSupport: form.decisionSupport,
      monitoringPlan: form.monitoringPlan,
      riskManagement: form.riskManagement,
      rightsAdvocacy: form.rightsAdvocacy,
    },
    goals: {
      longGoals,
      shortGoals,
      supportMeasures,
    },
    ibd: {
      enabled: validation.ibdIncluded,
      envAdjustment: form.ibdEnvAdjustment || '',
      pbsStrategy: form.ibdPbsStrategy || '',
    },
    compliance: validation,
    meta: {
      schemaVersion: '2026-04-v1',
      exportedAt: new Date().toISOString(),
      sourceDraftId: draft.id,
      userName: draft.name,
    },
  };
}

/** 
 * logic for determining if IBD sheet is active.
 * Shared with validation logic.
 */
export function isIbdActive(form: SupportPlanForm): boolean {
  const isIntensity = form.supportLevel.includes('強度');
  const hasIbdData = (form.ibdEnvAdjustment?.length || 0) > 0 || (form.ibdPbsStrategy?.length || 0) > 0;
  return isIntensity || hasIbdData;
}
