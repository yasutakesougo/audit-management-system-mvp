export type DiffSeverity = 'info' | 'warn' | 'critical';

export type GoalChange = {
  id: string;
  label: string;
  type: 'long' | 'short' | 'support';
  kind: 'added' | 'removed' | 'modified' | 'completed';
  changes?: Array<{
    field: string;
    before: string;
    after: string;
  }>;
};

export type SafetyChange = {
  kind: 'new_risk' | 'mitigation_updated';
  message: string;
  severity: DiffSeverity;
};

export type SupportPlanDiff = {
  summary: {
    hasStructuralChange: boolean;
    hasCriticalSafetyUpdate: boolean;
    totalChanges: number;
  };
  goals: GoalChange[];
  safety: SafetyChange[];
};
