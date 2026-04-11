import type { MonitoringMeetingRecord } from './monitoringMeeting';
import type { SupportPlanningSheet, ProcedureStep } from './schema';
import { safeRandomUUID } from '@/lib/uuid';

export type PlanPatchStatus =
  | 'draft'
  | 'review'
  | 'confirmed'
  | 'needs_update';

export type PlanPatchTarget = 'plan' | 'procedure';

export type PlanPatchBase = {
  id: string;
  planningSheetId: string;
  baseVersion: string;
  reason: string;
  evidenceIds: string[];
  status: PlanPatchStatus;
  dueAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type PlanPatchForPlan = PlanPatchBase & {
  target: 'plan';
  before: Partial<SupportPlanningSheet>;
  after: Partial<SupportPlanningSheet>;
};

export type PlanPatchForProcedure = PlanPatchBase & {
  target: 'procedure';
  before: ProcedureStep[];
  after: ProcedureStep[];
};

export type PlanPatch = PlanPatchForPlan | PlanPatchForProcedure;

export type MeetingDecision = Pick<
  MonitoringMeetingRecord,
  | 'id'
  | 'planningSheetId'
  | 'planChangeDecision'
  | 'changeReason'
  | 'discussionSummary'
  | 'issueSummary'
  | 'effectiveSupportSummary'
  | 'nextActions'
  | 'requiresPlanSheetUpdate'
  | 'meetingDate'
  | 'nextMonitoringDate'
>;

function buildReason(decision: MeetingDecision): string {
  const parts = [
    decision.changeReason,
    decision.issueSummary,
    decision.discussionSummary,
  ].map((value) => value?.trim()).filter(Boolean);

  if (parts.length > 0) {
    return parts.join('\n\n');
  }

  return `モニタリング会議（${decision.meetingDate}）の結果に基づく更新案`;
}

function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function addDays(dateOnly: string, days: number): string {
  const date = new Date(`${dateOnly}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function resolvePatchDueAt(
  decision: MeetingDecision,
  currentPlan: SupportPlanningSheet,
): string | undefined {
  const dueAtFromSchedule =
    toDateOnly(decision.nextMonitoringDate) ??
    toDateOnly(currentPlan.nextReviewAt);

  if (dueAtFromSchedule) {
    return dueAtFromSchedule;
  }

  const meetingDate = toDateOnly(decision.meetingDate);
  return meetingDate ? addDays(meetingDate, 7) : undefined;
}

export function generatePlanPatch(
  decision: MeetingDecision,
  currentPlan: SupportPlanningSheet,
): PlanPatchForPlan | null {
  if (!decision.planningSheetId || decision.planChangeDecision === 'no_change') {
    return null;
  }

  const now = new Date().toISOString();
  const nextReviewAt = decision.nextMonitoringDate || currentPlan.nextReviewAt;
  const dueAt = resolvePatchDueAt(decision, currentPlan);

  const before: Partial<SupportPlanningSheet> = {
    reviewedAt: currentPlan.reviewedAt,
    nextReviewAt: currentPlan.nextReviewAt,
    status: currentPlan.status,
    supportIssues: currentPlan.supportIssues,
    supportPolicy: currentPlan.supportPolicy,
    concreteApproaches: currentPlan.concreteApproaches,
  };

  const summaryBlocks = [
    decision.issueSummary?.trim() ? `【会議で確認した課題】\n${decision.issueSummary.trim()}` : '',
    decision.effectiveSupportSummary?.trim() ? `【継続候補の支援】\n${decision.effectiveSupportSummary.trim()}` : '',
    decision.nextActions?.length ? `【次回までの確認事項】\n${decision.nextActions.join('\n')}` : '',
  ].filter(Boolean);

  const nextApproaches = summaryBlocks.length
    ? [currentPlan.concreteApproaches, ...summaryBlocks].filter(Boolean).join('\n\n')
    : currentPlan.concreteApproaches;

  const after: Partial<SupportPlanningSheet> = {
    reviewedAt: decision.meetingDate,
    nextReviewAt,
    status: 'revision_pending',
    supportIssues: decision.issueSummary?.trim()
      ? [currentPlan.supportIssues, `【会議追記 ${decision.meetingDate}】\n${decision.issueSummary.trim()}`]
          .filter(Boolean)
          .join('\n\n')
      : currentPlan.supportIssues,
    supportPolicy: decision.changeReason?.trim()
      ? [currentPlan.supportPolicy, `【更新理由 ${decision.meetingDate}】\n${decision.changeReason.trim()}`]
          .filter(Boolean)
          .join('\n\n')
      : currentPlan.supportPolicy,
    concreteApproaches: nextApproaches,
  };

  return {
    id: `patch-${safeRandomUUID()}`,
    planningSheetId: decision.planningSheetId,
    baseVersion: String(currentPlan.version),
    target: 'plan',
    before,
    after,
    reason: buildReason(decision),
    evidenceIds: [decision.id],
    status: decision.requiresPlanSheetUpdate ? 'needs_update' : 'draft',
    dueAt,
    createdAt: now,
    updatedAt: now,
  };
}

export function applyPlanPatch(
  patch: PlanPatch,
  currentPlan: SupportPlanningSheet,
): SupportPlanningSheet {
  if (patch.baseVersion !== String(currentPlan.version)) {
    throw new Error('VERSION_CONFLICT');
  }

  if (patch.target === 'procedure') {
    return {
      ...currentPlan,
      planning: {
        ...currentPlan.planning,
        procedureSteps: patch.after,
      },
    };
  }

  return {
    ...currentPlan,
    ...patch.after,
  };
}

export function validatePlanPatch(
  patch: PlanPatch,
): 'ok' | 'warning' | 'return' | 'hold' {
  if (!patch.planningSheetId || patch.evidenceIds.length === 0) {
    return 'return';
  }

  if (!patch.reason.trim()) {
    return 'warning';
  }

  if (patch.target === 'plan') {
    return Object.keys(patch.after).length === 0 ? 'hold' : 'ok';
  }

  return patch.after.length === 0 ? 'hold' : 'ok';
}

function toReferenceDate(referenceDate: string | Date): string {
  if (referenceDate instanceof Date) {
    return referenceDate.toISOString().slice(0, 10);
  }
  return referenceDate.slice(0, 10);
}

export function isPlanPatchOverdue(
  patch: PlanPatch,
  referenceDate: string | Date = new Date(),
): boolean {
  if (!patch.dueAt || patch.status === 'confirmed') {
    return false;
  }

  const dueAt = toDateOnly(patch.dueAt);
  if (!dueAt) return false;

  return dueAt < toReferenceDate(referenceDate);
}

export function detectPlanNeedsUpdate(patches: readonly PlanPatch[]): boolean {
  return patches.some((patch) => patch.status !== 'confirmed');
}
