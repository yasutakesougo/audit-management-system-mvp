import type { SupportPlanDiff, GoalChange, SafetyChange } from './diffEngine.types';
import type { SupportPlanExportModel } from '../types/export';

function normalizeText(value: string | undefined): string {
  return (value ?? '').trim();
}

function keyGoals(goals: string[]): Map<string, string> {
  return new Map(
    goals
      .map((goal) => normalizeText(goal))
      .filter(Boolean)
      .map((goal) => [goal, goal]),
  );
}

function diffGoalList(
  before: string[],
  after: string[],
  type: 'long' | 'short' | 'support',
): GoalChange[] {
  const beforeMap = keyGoals(before);
  const afterMap = keyGoals(after);

  const changes: GoalChange[] = [];

  for (const [key, label] of afterMap) {
    if (!beforeMap.has(key)) {
      changes.push({
        id: `${type}:${key}`,
        label,
        type,
        kind: 'added',
      });
    }
  }

  for (const [key, label] of beforeMap) {
    if (!afterMap.has(key)) {
      changes.push({
        id: `${type}:${key}`,
        label,
        type,
        kind: 'removed',
      });
    }
  }

  return changes;
}

function diffSafety(before: SupportPlanExportModel, after: SupportPlanExportModel): SafetyChange[] {
  const changes: SafetyChange[] = [];

  const beforeRisk = normalizeText(before.coreIsp.riskManagement);
  const afterRisk = normalizeText(after.coreIsp.riskManagement);

  if (!beforeRisk && afterRisk) {
    changes.push({
      kind: 'new_risk',
      message: 'リスク管理・安全対策が新規追加された',
      severity: 'critical',
    });
  } else if (beforeRisk !== afterRisk && afterRisk) {
    changes.push({
      kind: 'mitigation_updated',
      message: 'リスク管理・安全対策が更新された',
      severity: 'warn',
    });
  }

  return changes;
}

export function buildSupportPlanDiff(
  before: SupportPlanExportModel,
  after: SupportPlanExportModel,
): SupportPlanDiff {
  const goals = [
    ...diffGoalList(before.goals.longGoals, after.goals.longGoals, 'long'),
    ...diffGoalList(before.goals.shortGoals, after.goals.shortGoals, 'short'),
    ...diffGoalList(before.goals.supportMeasures, after.goals.supportMeasures, 'support'),
  ];

  const safety = diffSafety(before, after);

  return {
    summary: {
      hasStructuralChange: goals.length > 0,
      hasCriticalSafetyUpdate: safety.some((item) => item.severity === 'critical'),
      totalChanges: goals.length + safety.length,
    },
    goals,
    safety,
  };
}
