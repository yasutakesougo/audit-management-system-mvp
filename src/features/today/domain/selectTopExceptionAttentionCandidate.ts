import type { TodayExceptionAction } from '@/features/exceptions/domain/buildTodayExceptions';
import {
  buildChildCountByParentId,
  computeExceptionPriorityScore,
} from '@/features/exceptions/domain/computeExceptionPriorityScore';
import type { ExceptionItem, ExceptionSeverity } from '@/features/exceptions/domain/exceptionLogic';

const SEVERITY_ORDER: Record<ExceptionSeverity, number> = {
  critical: 1,
  high: 2,
  medium: 3,
  low: 4,
};

function getSortDate(item: ExceptionItem): number {
  const dateStr = item.targetDate ?? item.updatedAt;
  if (!dateStr) return 0;
  const ts = new Date(dateStr).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

export type ExceptionAttentionCandidate = {
  action: TodayExceptionAction;
  sourceException: ExceptionItem;
  score: number;
};

export type SelectTopExceptionAttentionCandidateInput = {
  actions: TodayExceptionAction[];
  sourceExceptions: ExceptionItem[];
  now?: Date;
};

export function rankTodayExceptionActionsByPriority(
  input: SelectTopExceptionAttentionCandidateInput,
): ExceptionAttentionCandidate[] {
  const { actions, sourceExceptions, now = new Date() } = input;
  if (actions.length === 0 || sourceExceptions.length === 0) return [];

  const sourceById = new Map(sourceExceptions.map((item) => [item.id, item]));
  const childCountByParentId = buildChildCountByParentId(sourceExceptions);

  const ranked: ExceptionAttentionCandidate[] = [];
  for (const action of actions) {
    const sourceException = sourceById.get(action.sourceExceptionId);
    if (!sourceException) continue;
    ranked.push({
      action,
      sourceException,
      score: computeExceptionPriorityScore(sourceException, { now, childCountByParentId }),
    });
  }

  ranked.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score;

    const severityDiff =
      SEVERITY_ORDER[a.sourceException.severity] - SEVERITY_ORDER[b.sourceException.severity];
    if (severityDiff !== 0) return severityDiff;

    const dateDiff = getSortDate(b.sourceException) - getSortDate(a.sourceException);
    if (dateDiff !== 0) return dateDiff;

    return a.sourceException.id.localeCompare(b.sourceException.id);
  });

  return ranked;
}

export function selectTopExceptionAttentionCandidate(
  input: SelectTopExceptionAttentionCandidateInput,
): ExceptionAttentionCandidate | null {
  const ranked = rankTodayExceptionActionsByPriority(input);
  return ranked[0] ?? null;
}
