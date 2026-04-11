import type { MonitoringMeetingRecord } from './monitoringMeeting';
import { calculateImprovementFactor, type ImprovementOutcome } from './improvementOutcome';
import { isPlanPatchOverdue, type PlanPatch } from './planPatch';

export type PdcaHealthSeverity = 'low' | 'medium' | 'high' | 'critical';

export type PdcaHealthScore = {
  planningSheetId: string;
  userId: string;
  pendingPatchCount: number;
  overdueDays: number;
  daysSinceLastMeeting: number;
  evidenceCount: number;
  improvementSuccessRate: number;
  improvementFactor: number;
  manualOutcomeCount: number;
  derivedOutcomeCount: number;
  confidenceScore: 'low' | 'medium' | 'high';
  baseScore: number;
  score: number;
  severity: PdcaHealthSeverity;
};

type PdcaHealthMetricsInput = Pick<
  PdcaHealthScore,
  'pendingPatchCount' | 'overdueDays' | 'daysSinceLastMeeting' | 'evidenceCount'
>;

type BuildPdcaHealthScoreInput = {
  planningSheetId: string;
  userId: string;
  patches: PlanPatch[];
  meetings: MonitoringMeetingRecord[];
  outcomes?: ImprovementOutcome[];
  referenceDate?: string | Date;
};

function toDateOnly(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10);
  }
  const normalized = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function daysBetween(startDate: string | null, endDate: string): number {
  if (!startDate) return 0;
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 86_400_000));
}

export function calculatePdcaHealthScore(
  input: PdcaHealthMetricsInput,
): Pick<PdcaHealthScore, 'baseScore' | 'severity'> {
  const baseScore =
    input.pendingPatchCount * 10 +
    input.overdueDays * 5 +
    input.daysSinceLastMeeting * 2 +
    input.evidenceCount;

  let severity: PdcaHealthSeverity;

  if (input.overdueDays >= 7 || input.pendingPatchCount >= 5) {
    severity = 'critical';
  } else if (input.overdueDays >= 3) {
    severity = 'high';
  } else if (input.pendingPatchCount > 0) {
    severity = 'medium';
  } else {
    severity = 'low';
  }

  return { baseScore, severity };
}

export function buildPdcaHealthScore(
  input: BuildPdcaHealthScoreInput,
): PdcaHealthScore {
  const referenceDate = toDateOnly(input.referenceDate ?? new Date()) ?? new Date().toISOString().slice(0, 10);
  const pendingPatches = input.patches.filter((patch) => patch.status !== 'confirmed');
  const overdueDays = pendingPatches.reduce((max, patch) => {
    if (!isPlanPatchOverdue(patch, referenceDate) || !patch.dueAt) {
      return max;
    }
    return Math.max(max, daysBetween(toDateOnly(patch.dueAt), referenceDate));
  }, 0);

  const lastMeetingDate = input.meetings
    .map((meeting) => toDateOnly(meeting.meetingDate))
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => b.localeCompare(a))[0] ?? null;

  const daysSinceLastMeeting = daysBetween(lastMeetingDate, referenceDate);
  const evidenceCount = new Set(
    pendingPatches.flatMap((patch) => patch.evidenceIds),
  ).size;
  const improvementSuccessRate = calculateImprovementFactor(input.outcomes ?? []);
  const improvementFactor = improvementSuccessRate;

  const manualOutcomeCount = (input.outcomes ?? []).filter(o => o.source === 'manual_kpi').length;
  const derivedOutcomeCount = (input.outcomes ?? []).filter(o => o.source === 'derived').length;
  
  const confidenceScore =
    manualOutcomeCount >= 10 ? 'high' :
    manualOutcomeCount >= 3 ? 'medium' :
    'low';

  const metrics: PdcaHealthMetricsInput = {
    pendingPatchCount: pendingPatches.length,
    overdueDays,
    daysSinceLastMeeting,
    evidenceCount,
  };

  const { baseScore, severity } = calculatePdcaHealthScore(metrics);
  const score = Math.round(baseScore * (1 + improvementFactor));

  return {
    planningSheetId: input.planningSheetId,
    userId: input.userId,
    ...metrics,
    improvementSuccessRate,
    improvementFactor,
    manualOutcomeCount,
    derivedOutcomeCount,
    confidenceScore,
    baseScore,
    score,
    severity,
  };
}
