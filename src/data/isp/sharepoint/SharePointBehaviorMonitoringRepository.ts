/**
 * SharePoint BehaviorMonitoring Repository — PDCA Check (L2)
 *
 * @see src/domain/isp/port.ts
 * @see src/sharepoint/fields/pdcaCycleFields.ts
 */

import type {
  BehaviorAchievementLevel,
  BehaviorMonitoringRecord,
  EnvironmentFinding,
  SupportMethodEvaluation,
} from '@/domain/isp/behaviorMonitoring';
import type { BehaviorMonitoringRepository } from '@/domain/isp/port';
import type { UseSP } from '@/lib/spClient';
import {
  BEHAVIOR_MONITORING_FIELDS,
  BEHAVIOR_MONITORING_LIST_TITLE,
  BEHAVIOR_MONITORING_SELECT_FIELDS,
  safeJsonParse,
  type SpBehaviorMonitoringRow,
} from '@/sharepoint/fields/pdcaCycleFields';
import { z } from 'zod';

const SELECT = [...BEHAVIOR_MONITORING_SELECT_FIELDS] as string[];
const escapeOData = (s: string) => s.replace(/'/g, "''");

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

function normalizeAchievementLevel(raw: unknown): BehaviorAchievementLevel {
  switch (raw) {
    case 'effective':
    case 'mostly_effective':
    case 'partial':
    case 'not_effective':
    case 'not_observed':
      return raw;
    default:
      return 'not_observed';
  }
}

function toSupportEvaluations(raw: unknown): SupportMethodEvaluation[] {
  const parsed = safeJsonParse<unknown[]>(raw, []);
  return parsed
    .map((value): SupportMethodEvaluation | null => {
      if (!value || typeof value !== 'object') return null;
      const item = value as Record<string, unknown>;

      const candidate: SupportMethodEvaluation = {
        methodDescription: String(item.methodDescription ?? ''),
        achievementLevel: normalizeAchievementLevel(item.achievementLevel),
        comment: String(item.comment ?? ''),
      };

      const validated = supportMethodEvaluationSchema.safeParse(candidate);
      return validated.success ? validated.data : null;
    })
    .filter((item): item is SupportMethodEvaluation => item !== null);
}

function toEnvironmentFindings(raw: unknown): EnvironmentFinding[] {
  const parsed = safeJsonParse<unknown[]>(raw, []);
  return parsed
    .map((value): EnvironmentFinding | null => {
      if (!value || typeof value !== 'object') return null;
      const item = value as Record<string, unknown>;

      const candidate: EnvironmentFinding = {
        adjustment: String(item.adjustment ?? ''),
        wasEffective: Boolean(item.wasEffective),
        comment: String(item.comment ?? ''),
      };

      const validated = environmentFindingSchema.safeParse(candidate);
      return validated.success ? validated.data : null;
    })
    .filter((item): item is EnvironmentFinding => item !== null);
}

function toStringArray(raw: unknown): string[] {
  const parsed = safeJsonParse<unknown[]>(raw, []);
  return parsed.map((v) => String(v));
}

function mapRowToDomain(row: SpBehaviorMonitoringRow): BehaviorMonitoringRecord {
  const mapped = {
    id: `sp-${row.Id ?? ''}`,
    userId: String(row.UserId ?? ''),
    planningSheetId: String(row.PlanningSheetId ?? ''),
    periodStart: String(row.PeriodStart ?? ''),
    periodEnd: String(row.PeriodEnd ?? ''),
    supportEvaluations: toSupportEvaluations(row.SupportEvaluationsJson),
    environmentFindings: toEnvironmentFindings(row.EnvironmentFindingsJson),
    effectiveSupports: String(row.EffectiveSupports ?? ''),
    difficultiesObserved: String(row.DifficultiesObserved ?? ''),
    newTriggers: toStringArray(row.NewTriggersJson),
    medicalSafetyNotes: String(row.MedicalSafetyNotes ?? ''),
    userFeedback: String(row.UserFeedback ?? ''),
    familyFeedback: String(row.FamilyFeedback ?? ''),
    recommendedChanges: toStringArray(row.RecommendedChangesJson),
    summary: String(row.Summary ?? ''),
    recordedBy: String(row.RecordedBy ?? ''),
    recordedAt: String(row.RecordedAt ?? row.Created ?? ''),
  };

  const result = behaviorMonitoringRecordSchema.safeParse(mapped);
  if (!result.success) {
    throw new Error(
      `[BehaviorMonitoringRepository] Invalid row data (Id=${String(row.Id ?? 'unknown')}): ${result.error.issues[0]?.message ?? 'schema error'}`,
    );
  }

  return result.data;
}

export function createSharePointBehaviorMonitoringRepository(
  client: UseSP,
): BehaviorMonitoringRepository {
  return {
    async findByPlanningSheetId({
      planningSheetId,
      userId,
    }: {
      planningSheetId: string;
      userId: string;
    }): Promise<BehaviorMonitoringRecord[]> {
      const filter =
        `${BEHAVIOR_MONITORING_FIELDS.planningSheetId} eq '${escapeOData(planningSheetId)}' and ` +
        `${BEHAVIOR_MONITORING_FIELDS.userId} eq '${escapeOData(userId)}'`;

      const rows = await client.listItems<SpBehaviorMonitoringRow>(
        BEHAVIOR_MONITORING_LIST_TITLE,
        {
          select: SELECT,
          filter,
          orderby: `${BEHAVIOR_MONITORING_FIELDS.periodEnd} desc, ${BEHAVIOR_MONITORING_FIELDS.recordedAt} desc`,
        },
      );

      return rows.map(mapRowToDomain);
    },
  };
}
