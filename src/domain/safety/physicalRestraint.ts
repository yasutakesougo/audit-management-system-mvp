// ---------------------------------------------------------------------------
// PhysicalRestraint — 身体拘束等記録のドメイン型
//
// 運営基準が求める身体拘束記録をシステムに内包する。
// 三要件（切迫性・非代替性・一時性）の確認と、
// 開始/終了からの自動時間計算を提供する。
//
// 法的根拠:
//   - 障害者総合支援法 指定障害福祉サービスの事業等の人員、設備及び運営に関する基準
//   - 第35条（身体拘束等の禁止）
//   - 身体拘束適正化のための指針
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum Values
// ---------------------------------------------------------------------------

/** 身体拘束の態様 */
export const restraintTypeValues = [
  '車いす固定ベルト',
  'ベッド柵による行動制限',
  '居室施錠',
  'つなぎ服着用',
  'ミトン型手袋着用',
  '手指の機能制限',
  '立ち上がり抑制（Y字型抑制帯等）',
  '介護衣着用',
  '向精神薬による行動制限',
  'その他',
] as const;
export type RestraintType = (typeof restraintTypeValues)[number];

/** 記録ステータス */
export const restraintStatusValues = ['draft', 'submitted', 'approved', 'rejected'] as const;
export type RestraintStatus = (typeof restraintStatusValues)[number];

// ---------------------------------------------------------------------------
// Three Requirements (三要件)
// ---------------------------------------------------------------------------

export type ThreeRequirements = {
  /** 切迫性: 利用者等の生命・身体に危険が及ぶ可能性が著しく高い */
  immediacy: boolean;
  /** 切迫性の具体的状況 */
  immediacyReason: string;
  /** 非代替性: 身体拘束以外に代替する介護方法がない */
  nonSubstitutability: boolean;
  /** 非代替性の具体的検討内容 */
  nonSubstitutabilityReason: string;
  /** 一時性: 身体拘束が一時的なものである */
  temporariness: boolean;
  /** 一時性の具体的見通し */
  temporarinessReason: string;
};

// ---------------------------------------------------------------------------
// PhysicalRestraintRecord
// ---------------------------------------------------------------------------

export type PhysicalRestraintRecord = {
  id: string;
  userId: string;

  // ── 実施記録 ──
  /** 実施有無 */
  performed: boolean;
  /** 態様（どのような拘束か） */
  restraintType: RestraintType;
  /** 開始日時 (ISO 8601) */
  startedAt: string;
  /** 終了日時 (ISO 8601) */
  endedAt: string;
  /** 継続時間（分）— 自動算出 */
  durationMinutes: number;

  // ── 三要件確認 ──
  threeRequirements: ThreeRequirements;

  // ── 理由・状況 ──
  /** 緊急やむを得ない理由 */
  reason: string;
  /** 心身の状況 */
  physicalMentalCondition: string;
  /** 周囲の状況 */
  surroundingCondition: string;

  // ── 記録者・承認 ──
  /** 記録者 */
  recordedBy: string;
  /** 記録日時 (ISO 8601) */
  recordedAt: string;
  /** 承認者 */
  approvedBy?: string;
  /** 承認日時 (ISO 8601) */
  approvedAt?: string;
  /** ステータス */
  status: RestraintStatus;

  // ── 関連 ──
  /** 関連インシデントID（P0-1 へのリンク） */
  relatedIncidentId?: string;
};

// ---------------------------------------------------------------------------
// Schemas (Zod)
// ---------------------------------------------------------------------------

const threeRequirementsSchema = z.object({
  immediacy: z.boolean().default(false),
  immediacyReason: z.string().default(''),
  nonSubstitutability: z.boolean().default(false),
  nonSubstitutabilityReason: z.string().default(''),
  temporariness: z.boolean().default(false),
  temporarinessReason: z.string().default(''),
});

export const physicalRestraintDraftSchema = z.object({
  userId: z.string().min(1),
  performed: z.boolean().default(true),
  restraintType: z.enum(restraintTypeValues).default('その他'),
  startedAt: z.string().datetime().default(() => new Date().toISOString()),
  endedAt: z
    .string()
    .datetime()
    .default(() => new Date().toISOString()),
  threeRequirements: threeRequirementsSchema.default({
    immediacy: false,
    immediacyReason: '',
    nonSubstitutability: false,
    nonSubstitutabilityReason: '',
    temporariness: false,
    temporarinessReason: '',
  }),
  reason: z.string().default(''),
  physicalMentalCondition: z.string().default(''),
  surroundingCondition: z.string().default(''),
  recordedBy: z.string().default(''),
  relatedIncidentId: z.string().optional(),
});

export type PhysicalRestraintDraft = z.infer<typeof physicalRestraintDraftSchema>;

// ---------------------------------------------------------------------------
// Domain Helpers
// ---------------------------------------------------------------------------

/** 開始/終了日時から継続時間（分）を算出する */
export function computeDurationMinutes(startedAt: string, endedAt: string): number {
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.round((end - start) / 60_000);
}

/** 三要件がすべて確認されているか */
export function allThreeRequirementsMet(req: ThreeRequirements): boolean {
  return req.immediacy && req.nonSubstitutability && req.temporariness;
}

/** 三要件のうち確認された数 */
export function countMetRequirements(req: ThreeRequirements): number {
  return [req.immediacy, req.nonSubstitutability, req.temporariness].filter(Boolean).length;
}

/** Draft から Record に変換する */
export function fromDraftToRestraintRecord(
  id: string,
  draft: PhysicalRestraintDraft,
): PhysicalRestraintRecord {
  return {
    id,
    userId: draft.userId,
    performed: draft.performed,
    restraintType: draft.restraintType,
    startedAt: draft.startedAt,
    endedAt: draft.endedAt,
    durationMinutes: computeDurationMinutes(draft.startedAt, draft.endedAt),
    threeRequirements: { ...draft.threeRequirements },
    reason: draft.reason,
    physicalMentalCondition: draft.physicalMentalCondition,
    surroundingCondition: draft.surroundingCondition,
    recordedBy: draft.recordedBy,
    recordedAt: new Date().toISOString(),
    status: 'draft',
    relatedIncidentId: draft.relatedIncidentId,
  };
}

/** 空の Draft を作成する */
export function createEmptyRestraintDraft(
  userId: string,
  relatedIncidentId?: string,
): PhysicalRestraintDraft {
  return physicalRestraintDraftSchema.parse({
    userId,
    relatedIncidentId,
  });
}

// ---------------------------------------------------------------------------
// Summary Types (for dashboard aggregation)
// ---------------------------------------------------------------------------

export type RestraintSummary = {
  total: number;
  byType: Partial<Record<RestraintType, number>>;
  byStatus: Record<RestraintStatus, number>;
  pendingApproval: number;
  last30Days: number;
  /** 平均継続時間（分） */
  avgDurationMinutes: number;
  /** 三要件未充足の件数 */
  incompleteRequirements: number;
};

/** PhysicalRestraintRecord[] からサマリーを算出する */
export function computeRestraintSummary(records: PhysicalRestraintRecord[]): RestraintSummary {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const byType: Partial<Record<RestraintType, number>> = {};
  const byStatus: Record<RestraintStatus, number> = {
    draft: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
  };
  let pendingApproval = 0;
  let last30Days = 0;
  let totalDuration = 0;
  let incompleteRequirements = 0;

  for (const r of records) {
    byType[r.restraintType] = (byType[r.restraintType] ?? 0) + 1;
    byStatus[r.status]++;
    if (r.status === 'submitted') pendingApproval++;
    if (new Date(r.startedAt) >= thirtyDaysAgo) last30Days++;
    totalDuration += r.durationMinutes;
    if (!allThreeRequirementsMet(r.threeRequirements)) incompleteRequirements++;
  }

  return {
    total: records.length,
    byType,
    byStatus,
    pendingApproval,
    last30Days,
    avgDurationMinutes: records.length > 0 ? Math.round(totalDuration / records.length) : 0,
    incompleteRequirements,
  };
}
