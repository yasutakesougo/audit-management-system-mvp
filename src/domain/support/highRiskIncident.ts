/**
 * High-Risk Incident Domain Types
 *
 * This module defines domain types for high-risk incident tracking and analysis.
 * Supports behavioral analysis workflow: incident → antecedent/behavior/consequence → function hypothesis
 *
 * Key components:
 * - Enum types for standardized categories (severity, behaviors, functions, etc.)
 * - Detailed draft schema for incident data collection
 * - Simplified incident type for external APIs/storage
 * - Function derivation logic based on behavioral analysis principles
 * - Type-safe conversion utilities
 */

import { z } from 'zod';

export const severityValues = ['低', '中', '高', '重大インシデント'] as const;
export type RiskSeverity = (typeof severityValues)[number];

export const behaviorValues = ['身体的攻撃', '物品破壊', '自己傷害', '言語的攻撃', 'その他'] as const;
export type BehaviorValue = (typeof behaviorValues)[number];

export const antecedentValues = ['活動切り替え', '感覚過敏', '対人トラブル', '課題要求', 'その他'] as const;
export type AntecedentValue = (typeof antecedentValues)[number];

export const consequenceValues = ['注目を得た', '要求が通った', '活動から離脱', '身体的介入', 'その他'] as const;
export type ConsequenceValue = (typeof consequenceValues)[number];

export const functionValues = ['注目獲得', '逃避 / 回避', '物理的獲得', '感覚刺激', '特定不能'] as const;
export type FunctionValue = (typeof functionValues)[number];

const behaviorSchema = z.object({
  behaviorObserved: z.string().default(''),
  intensityScale: z.number().min(1).max(5).default(1),
  durationMinutes: z.number().min(0).max(240).default(0),
});

const antecedentSchema = z.object({
  antecedentType: z.enum(antecedentValues).or(z.literal('')).default(''),
  contextNotes: z.string().default(''),
  relatedIcebergFactors: z.array(z.string()).default([]),
});

const consequenceSchema = z.object({
  consequenceReceived: z.array(z.enum(consequenceValues)).default([]),
  staffInterventionNotes: z.string().default(''),
});

const hypothesisSchema = z.object({
  hypothesizedFunction: z.enum(functionValues).default('特定不能'),
  confidenceLevel: z.number().min(1).max(3).default(1),
});

export const highRiskIncidentDraftSchema = z.object({
  personId: z.string(),
  supportPlanId: z.string(),
  reportedAtStepId: z.string().optional(),
  incidentTimestamp: z.string().datetime().default(() => new Date().toISOString()),
  targetBehavior: z.string().default(''),
  severity: z.enum(severityValues).default('低'),
  behavior: behaviorSchema.default({ behaviorObserved: '', intensityScale: 1, durationMinutes: 0 }),
  antecedent: antecedentSchema.default({ antecedentType: '', contextNotes: '', relatedIcebergFactors: [] }),
  consequence: consequenceSchema.default({ consequenceReceived: [], staffInterventionNotes: '' }),
  hypothesis: hypothesisSchema.default({ hypothesizedFunction: '特定不能', confidenceLevel: 1 }),
});

export type HighRiskIncidentDraft = z.infer<typeof highRiskIncidentDraftSchema>;

export type HighRiskIncident = {
  id: string;
  userId: string;
  occurredAt: string;
  severity: RiskSeverity;
  description?: string;
  triggers?: string[];
  actions?: string[];
  notes?: string;
};

/**
 * Convert detailed draft to simplified incident format.
 * Maps draft fields to external API/storage structure.
 */
export function fromDraftToIncident(id: string, draft: HighRiskIncidentDraft): HighRiskIncident {
  return {
    id,
    userId: draft.personId,
    occurredAt: draft.incidentTimestamp,
    severity: draft.severity,
    description: draft.targetBehavior || undefined,
    triggers: draft.antecedent.relatedIcebergFactors.length
      ? draft.antecedent.relatedIcebergFactors
      : undefined,
    actions: draft.consequence.consequenceReceived.length
      ? draft.consequence.consequenceReceived
      : undefined,
    notes: draft.consequence.staffInterventionNotes || undefined,
  };
}

/**
 * Create empty incident draft with minimal required fields.
 * Leverages schema defaults for all other fields.
 */
export function createEmptyIncidentDraft(
  personId: string,
  supportPlanId: string,
  reportedAtStepId?: string,
): HighRiskIncidentDraft {
  return highRiskIncidentDraftSchema.parse({
    personId,
    supportPlanId,
    reportedAtStepId,
    // All other fields use schema defaults
  });
}

/** Type-safe sets for consequence-to-function mapping */
const attentionSet = new Set<ConsequenceValue>(['注目を得た']);
const escapeSet = new Set<ConsequenceValue>(['活動から離脱']);
const tangibleSet = new Set<ConsequenceValue>(['要求が通った']);
const sensorySet = new Set<ConsequenceValue>(['身体的介入']);

/**
 * Derive suggested function based on antecedent and consequence patterns.
 * Implements behavioral analysis logic for function hypothesis.
 */
export function deriveSuggestedFunction(
  antecedentType: AntecedentValue | string,
  consequenceReceived: ReadonlyArray<ConsequenceValue>,
): FunctionValue {
  // Priority: consequence patterns (strongest indicators)
  for (const value of consequenceReceived) {
    if (attentionSet.has(value)) return '注目獲得';
    if (escapeSet.has(value)) return '逃避 / 回避';
    if (tangibleSet.has(value)) return '物理的獲得';
    if (sensorySet.has(value)) return '感覚刺激';
  }

  // Fallback: antecedent patterns
  if (antecedentType === '感覚過敏') return '感覚刺激';

  return '特定不能';
}

/**
 * Save high-risk incident to storage.
 *
 * TODO: Implement actual persistence layer
 * - Validate incident data with dedicated schema
 * - Handle create/update based on id presence
 * - Integrate with SharePoint/API client
 * - Add error handling and retry logic
 */
export async function saveHighRiskIncident(
  incident: HighRiskIncident,
): Promise<HighRiskIncident> {
  // Stub implementation - replace with actual persistence
  return incident;
}
