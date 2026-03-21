/**
 * SharePoint PlanningSheetReassessment Repository — PDCA Act (L2)
 *
 * @see src/domain/isp/port.ts
 * @see src/sharepoint/fields/pdcaCycleFields.ts
 */

import {
  computeNextReassessmentDueDate,
  type PlanChangeDecision,
  type PlanningSheetReassessment,
  type ReassessmentTrigger,
} from '@/domain/isp/planningSheetReassessment';
import type { PlanningSheetReassessmentRepository } from '@/domain/isp/port';
import type { UseSP } from '@/lib/spClient';
import {
  PLANNING_SHEET_REASSESSMENT_FIELDS,
  PLANNING_SHEET_REASSESSMENT_LIST_TITLE,
  PLANNING_SHEET_REASSESSMENT_SELECT_FIELDS,
  type SpPlanningSheetReassessmentRow,
} from '@/sharepoint/fields/pdcaCycleFields';
import { z } from 'zod';

const SELECT = [...PLANNING_SHEET_REASSESSMENT_SELECT_FIELDS] as string[];
const escapeOData = (s: string) => s.replace(/'/g, "''");

const reassessmentTriggerSchema = z.enum([
  'scheduled',
  'incident',
  'monitoring',
  'other',
]);

const planChangeDecisionSchema = z.enum([
  'no_change',
  'minor_revision',
  'major_revision',
  'urgent_revision',
]);

const planningSheetReassessmentSchema = z.object({
  id: z.string().min(1),
  planningSheetId: z.string().min(1),
  reassessedAt: z.string().min(1),
  reassessedBy: z.string().min(1),
  triggerType: reassessmentTriggerSchema,
  abcSummary: z.string(),
  hypothesisReview: z.string(),
  procedureEffectiveness: z.string(),
  environmentChange: z.string(),
  planChangeDecision: planChangeDecisionSchema,
  nextReassessmentAt: z.string().min(1),
  notes: z.string(),
});

function toDateOnly(value: string | undefined): string | null {
  if (!value) return null;
  return value.slice(0, 10);
}

function normalizeTrigger(raw: unknown): ReassessmentTrigger {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === 'scheduled' || value === 'scheduled_quarterly') return 'scheduled';
  if (value === 'incident') return 'incident';
  if (value === 'monitoring') return 'monitoring';
  if (value === '定期' || value === '3か月定期') return 'scheduled';
  if (value === '行動変化' || value === 'インシデント') return 'incident';
  if (value === '手順不全') return 'monitoring';
  return 'other';
}

function normalizeDecision(raw: unknown): PlanChangeDecision {
  const value = String(raw ?? '').trim().toLowerCase();

  switch (value) {
    case 'no_change':
    case 'none':
    case 'unchanged':
      return 'no_change';
    case 'minor_revision':
    case 'minor':
      return 'minor_revision';
    case 'major_revision':
    case 'major':
      return 'major_revision';
    case 'urgent_revision':
    case 'urgent':
      return 'urgent_revision';
    default:
      return 'no_change';
  }
}

function mapRowToDomain(
  row: SpPlanningSheetReassessmentRow,
): PlanningSheetReassessment {
  const reassessedAt =
    toDateOnly(row.ReassessmentDate) ??
    toDateOnly(row.CreatedAtText) ??
    toDateOnly(row.Created) ??
    '';

  const mapped = {
    id: `sp-${row.Id ?? ''}`,
    planningSheetId: String(row.PlanningSheetId ?? ''),
    reassessedAt,
    reassessedBy:
      String(row.ReassessedBy ?? row.CreatedByText ?? '').trim() || 'system',
    triggerType: normalizeTrigger(row.ReassessmentTrigger),
    abcSummary: String(row.AbcSummary ?? row.Summary ?? ''),
    hypothesisReview: String(row.HypothesisReview ?? row.Summary ?? ''),
    procedureEffectiveness: String(row.ProcedureEffectiveness ?? row.Summary ?? ''),
    environmentChange: String(row.EnvironmentChange ?? ''),
    planChangeDecision: normalizeDecision(row.PlanChangeDecision),
    nextReassessmentAt:
      toDateOnly(row.NextReassessmentAt) ??
      (reassessedAt ? computeNextReassessmentDueDate(reassessedAt) : ''),
    notes: String(row.Notes ?? row.Summary ?? ''),
  };

  const result = planningSheetReassessmentSchema.safeParse(mapped);
  if (!result.success) {
    throw new Error(
      `[PlanningSheetReassessmentRepository] Invalid row data (Id=${String(row.Id ?? 'unknown')}): ${result.error.issues[0]?.message ?? 'schema error'}`,
    );
  }

  return result.data;
}

export function createSharePointPlanningSheetReassessmentRepository(
  client: UseSP,
): PlanningSheetReassessmentRepository {
  return {
    async findByPlanningSheetId({
      planningSheetId,
    }: {
      planningSheetId: string;
    }): Promise<PlanningSheetReassessment[]> {
      const filter = `${PLANNING_SHEET_REASSESSMENT_FIELDS.planningSheetId} eq '${escapeOData(planningSheetId)}'`;

      const rows = await client.listItems<SpPlanningSheetReassessmentRow>(
        PLANNING_SHEET_REASSESSMENT_LIST_TITLE,
        {
          select: SELECT,
          filter,
          orderby: `${PLANNING_SHEET_REASSESSMENT_FIELDS.reassessmentDate} desc, Created desc`,
        },
      );

      return rows.map(mapRowToDomain);
    },
  };
}
