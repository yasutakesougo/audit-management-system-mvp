import { buildSelectFieldsFromMap } from './fieldUtils';

export const PLAN_PATCH_FIELDS = {
  patchId: 'PatchId',
  planningSheetId: 'PlanningSheetId',
  target: 'PatchTarget',
  baseVersion: 'BaseVersion',
  beforeJson: 'BeforeJson',
  afterJson: 'AfterJson',
  reason: 'PatchReason',
  evidenceIdsJson: 'EvidenceIdsJson',
  status: 'PatchStatus',
  dueAt: 'PatchDueAt',
  createdAt: 'PatchCreatedAt',
  updatedAt: 'PatchUpdatedAt',
} as const;

export const PLAN_PATCH_CANDIDATES = {
  patchId: [PLAN_PATCH_FIELDS.patchId, 'patchId', 'RecordId'],
  planningSheetId: [PLAN_PATCH_FIELDS.planningSheetId, 'planningSheetId'],
  target: [PLAN_PATCH_FIELDS.target, 'target'],
  baseVersion: [PLAN_PATCH_FIELDS.baseVersion, 'baseVersion'],
  beforeJson: [PLAN_PATCH_FIELDS.beforeJson, 'beforeJson'],
  afterJson: [PLAN_PATCH_FIELDS.afterJson, 'afterJson'],
  reason: [PLAN_PATCH_FIELDS.reason, 'reason'],
  evidenceIdsJson: [PLAN_PATCH_FIELDS.evidenceIdsJson, 'evidenceIds', 'evidenceIdsJson'],
  status: [PLAN_PATCH_FIELDS.status, 'status'],
  dueAt: [PLAN_PATCH_FIELDS.dueAt, 'dueAt'],
  createdAt: [PLAN_PATCH_FIELDS.createdAt, 'createdAt'],
  updatedAt: [PLAN_PATCH_FIELDS.updatedAt, 'updatedAt'],
} as const;

export const PLAN_PATCH_ESSENTIALS = [
  'patchId',
  'planningSheetId',
  'target',
  'status',
] as const;

export type PlanPatchCandidateKey = keyof typeof PLAN_PATCH_CANDIDATES;
export type PlanPatchFieldMapping = Partial<Record<PlanPatchCandidateKey, string>>;

export const PLAN_PATCH_SELECT_FIELDS = buildSelectFieldsFromMap(PLAN_PATCH_FIELDS, undefined, {
  alwaysInclude: ['Id', 'Title'],
});

export const PLAN_PATCH_ENSURE_FIELDS = [
  { internalName: PLAN_PATCH_FIELDS.patchId, type: 'Text', required: true },
  { internalName: PLAN_PATCH_FIELDS.planningSheetId, type: 'Text', required: true },
  { internalName: PLAN_PATCH_FIELDS.target, type: 'Text', required: true },
  { internalName: PLAN_PATCH_FIELDS.baseVersion, type: 'Text', required: true },
  { internalName: PLAN_PATCH_FIELDS.beforeJson, type: 'Note', required: false },
  { internalName: PLAN_PATCH_FIELDS.afterJson, type: 'Note', required: false },
  { internalName: PLAN_PATCH_FIELDS.reason, type: 'Note', required: false },
  { internalName: PLAN_PATCH_FIELDS.evidenceIdsJson, type: 'Note', required: false },
  { internalName: PLAN_PATCH_FIELDS.status, type: 'Text', required: true },
  { internalName: PLAN_PATCH_FIELDS.dueAt, type: 'Text', required: false },
  { internalName: PLAN_PATCH_FIELDS.createdAt, type: 'Text', required: true },
  { internalName: PLAN_PATCH_FIELDS.updatedAt, type: 'Text', required: true },
] as const;

export type SpPlanPatchRow = {
  Id?: number;
  Title?: string;
  PatchId?: string;
  PlanningSheetId?: string;
  PatchTarget?: string;
  BaseVersion?: string;
  BeforeJson?: string;
  AfterJson?: string;
  PatchReason?: string;
  EvidenceIdsJson?: string;
  PatchStatus?: string;
  PatchDueAt?: string;
  PatchCreatedAt?: string;
  PatchUpdatedAt?: string;
} & Record<string, unknown>;
