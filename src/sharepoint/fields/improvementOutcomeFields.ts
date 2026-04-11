import { buildSelectFieldsFromMap } from './fieldUtils';

export const IMPROVEMENT_OUTCOME_FIELDS = {
  outcomeId: 'OutcomeId',
  planningSheetId: 'PlanningSheetId',
  patchId: 'PatchId',
  observedAt: 'ObservedAt',
  targetMetric: 'TargetMetric',
  source: 'OutcomeSource',
  metricDefinitionId: 'MetricDefinitionId',
  beforeValue: 'BeforeValue',
  afterValue: 'AfterValue',
  changeRate: 'ChangeRate',
  isImproved: 'IsImproved',
  confidence: 'Confidence',
  evaluationWindowDays: 'EvaluationWindowDays',
  createdAt: 'CreatedAt',
} as const;

export const IMPROVEMENT_OUTCOME_CANDIDATES = {
  outcomeId: [IMPROVEMENT_OUTCOME_FIELDS.outcomeId, 'outcomeId', 'RecordId'],
  planningSheetId: [IMPROVEMENT_OUTCOME_FIELDS.planningSheetId, 'planningSheetId'],
  patchId: [IMPROVEMENT_OUTCOME_FIELDS.patchId, 'patchId'],
  observedAt: [IMPROVEMENT_OUTCOME_FIELDS.observedAt, 'observedAt'],
  targetMetric: [IMPROVEMENT_OUTCOME_FIELDS.targetMetric, 'targetMetric'],
  source: [IMPROVEMENT_OUTCOME_FIELDS.source, 'source'],
  metricDefinitionId: [IMPROVEMENT_OUTCOME_FIELDS.metricDefinitionId, 'metricDefinitionId'],
  beforeValue: [IMPROVEMENT_OUTCOME_FIELDS.beforeValue, 'beforeValue'],
  afterValue: [IMPROVEMENT_OUTCOME_FIELDS.afterValue, 'afterValue'],
  changeRate: [IMPROVEMENT_OUTCOME_FIELDS.changeRate, 'changeRate'],
  isImproved: [IMPROVEMENT_OUTCOME_FIELDS.isImproved, 'isImproved'],
  confidence: [IMPROVEMENT_OUTCOME_FIELDS.confidence, 'confidence'],
  evaluationWindowDays: [IMPROVEMENT_OUTCOME_FIELDS.evaluationWindowDays, 'evaluationWindowDays'],
  createdAt: [IMPROVEMENT_OUTCOME_FIELDS.createdAt, 'createdAt'],
} as const;

export const IMPROVEMENT_OUTCOME_ESSENTIALS = [
  'outcomeId',
  'planningSheetId',
  'patchId',
  'targetMetric',
  'source',
] as const;

export type ImprovementOutcomeCandidateKey = keyof typeof IMPROVEMENT_OUTCOME_CANDIDATES;
export type ImprovementOutcomeFieldMapping = Partial<Record<ImprovementOutcomeCandidateKey, string>>;

export const IMPROVEMENT_OUTCOME_SELECT_FIELDS = buildSelectFieldsFromMap(IMPROVEMENT_OUTCOME_FIELDS, undefined, {
  alwaysInclude: ['Id', 'Title'],
});

export const IMPROVEMENT_OUTCOME_ENSURE_FIELDS = [
  { internalName: IMPROVEMENT_OUTCOME_FIELDS.outcomeId, type: 'Text', required: true },
  { internalName: IMPROVEMENT_OUTCOME_FIELDS.planningSheetId, type: 'Text', required: true },
  { internalName: IMPROVEMENT_OUTCOME_FIELDS.patchId, type: 'Text', required: true },
  { internalName: IMPROVEMENT_OUTCOME_FIELDS.observedAt, type: 'Text', required: true },
  { internalName: IMPROVEMENT_OUTCOME_FIELDS.targetMetric, type: 'Text', required: true },
  { internalName: IMPROVEMENT_OUTCOME_FIELDS.source, type: 'Text', required: true },
  { internalName: IMPROVEMENT_OUTCOME_FIELDS.metricDefinitionId, type: 'Text', required: false },
  { internalName: IMPROVEMENT_OUTCOME_FIELDS.beforeValue, type: 'Number', required: true },
  { internalName: IMPROVEMENT_OUTCOME_FIELDS.afterValue, type: 'Number', required: true },
  { internalName: IMPROVEMENT_OUTCOME_FIELDS.changeRate, type: 'Number', required: true },
  { internalName: IMPROVEMENT_OUTCOME_FIELDS.isImproved, type: 'Boolean', required: true },
  { internalName: IMPROVEMENT_OUTCOME_FIELDS.confidence, type: 'Text', required: true },
  { internalName: IMPROVEMENT_OUTCOME_FIELDS.evaluationWindowDays, type: 'Number', required: false },
  { internalName: IMPROVEMENT_OUTCOME_FIELDS.createdAt, type: 'Text', required: true },
] as const;

export type SpImprovementOutcomeRow = {
  Id?: number;
  Title?: string;
  OutcomeId?: string;
  PlanningSheetId?: string;
  PatchId?: string;
  ObservedAt?: string;
  TargetMetric?: string;
  OutcomeSource?: string;
  MetricDefinitionId?: string;
  BeforeValue?: number;
  AfterValue?: number;
  ChangeRate?: number;
  IsImproved?: boolean;
  Confidence?: string;
  EvaluationWindowDays?: number;
  CreatedAt?: string;
} & Record<string, unknown>;
