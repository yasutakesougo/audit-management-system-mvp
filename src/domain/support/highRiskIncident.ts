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
  behaviorObserved: z.union([z.literal(''), z.string()]).default(''),
  intensityScale: z.number().min(1).max(5).default(1),
  durationMinutes: z.number().min(0).max(240).default(0),
});

const antecedentSchema = z.object({
  antecedentType: z.union([z.literal(''), z.string()]).default(''),
  contextNotes: z.string().default(''),
  relatedIcebergFactors: z.array(z.string()).default([]),
});

const consequenceSchema = z.object({
  consequenceReceived: z.array(z.string()).default([]),
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
  incidentTimestamp: z.string().default(() => new Date().toISOString()),
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

export function createEmptyIncidentDraft(
  personId: string,
  supportPlanId: string,
  reportedAtStepId?: string,
): HighRiskIncidentDraft {
  return highRiskIncidentDraftSchema.parse({
    personId,
    supportPlanId,
    reportedAtStepId,
    incidentTimestamp: new Date().toISOString(),
    targetBehavior: '',
    severity: '低',
    behavior: {
      behaviorObserved: '',
      intensityScale: 1,
      durationMinutes: 0,
    },
    antecedent: {
      antecedentType: '',
      contextNotes: '',
      relatedIcebergFactors: [],
    },
    consequence: {
      consequenceReceived: [],
      staffInterventionNotes: '',
    },
    hypothesis: {
      hypothesizedFunction: '特定不能',
      confidenceLevel: 1,
    },
  });
}

const attentionSet = new Set<string>(['注目を得た']);
const escapeSet = new Set<string>(['活動から離脱']);
const tangibleSet = new Set<string>(['要求が通った']);
const sensorySet = new Set<string>(['身体的介入']);

export function deriveSuggestedFunction(
  antecedentType: AntecedentValue | string,
  consequenceReceived: ReadonlyArray<string>,
): FunctionValue {
  for (const value of consequenceReceived) {
    if (attentionSet.has(value)) return '注目獲得';
    if (escapeSet.has(value)) return '逃避 / 回避';
    if (tangibleSet.has(value)) return '物理的獲得';
    if (sensorySet.has(value)) return '感覚刺激';
  }
  if (antecedentType === '感覚過敏') return '感覚刺激';
  return '特定不能';
}

export async function saveHighRiskIncident(
  incident: HighRiskIncident,
): Promise<HighRiskIncident> {
  return incident;
}
