/**
 * ISP 三層モデル — コンプライアンスメタデータスキーマ
 *
 * 生活介護制度要件（同意・交付・見直し・承認）と
 * 承認ドメインロジックを定義する。
 *
 * @see docs/adr/ADR-005-isp-three-layer-separation.md
 */

import { z } from 'zod';

// ─────────────────────────────────────────────
// コンプライアンスメタデータ構成要素
// ─────────────────────────────────────────────

/** 同意記録の詳細（生活介護制度要件） */
export const ispConsentDetailSchema = z.object({
  /** 説明実施日（ISO 8601） */
  explainedAt: z.string().nullable().default(null),
  /** 説明実施者名 */
  explainedBy: z.string().default(''),
  /** 同意取得日（ISO 8601） */
  consentedAt: z.string().nullable().default(null),
  /** 同意者名 */
  consentedBy: z.string().default(''),
  /** 代理人名（家族等が同意した場合） */
  proxyName: z.string().default(''),
  /** 代理人続柄 */
  proxyRelation: z.string().default(''),
  /** 備考 */
  notes: z.string().default(''),
}).default({
  explainedAt: null,
  explainedBy: '',
  consentedAt: null,
  consentedBy: '',
  proxyName: '',
  proxyRelation: '',
  notes: '',
});

export type IspConsentDetail = z.infer<typeof ispConsentDetailSchema>;

/** 交付記録の詳細（生活介護制度要件） */
export const ispDeliveryDetailSchema = z.object({
  /** 交付日（ISO 8601） */
  deliveredAt: z.string().nullable().default(null),
  /** 本人へ交付済み */
  deliveredToUser: z.boolean().default(false),
  /** 相談支援専門員へ交付済み */
  deliveredToConsultationSupport: z.boolean().default(false),
  /** 交付方法 */
  deliveryMethod: z.string().default(''),
  /** 備考 */
  notes: z.string().default(''),
}).default({
  deliveredAt: null,
  deliveredToUser: false,
  deliveredToConsultationSupport: false,
  deliveryMethod: '',
  notes: '',
});

export type IspDeliveryDetail = z.infer<typeof ispDeliveryDetailSchema>;

/** 見直し制御（6か月ルール） */
export const ispReviewControlSchema = z.object({
  /** 見直し周期（日） — 生活介護は原則 180日（6か月） */
  reviewCycleDays: z.number().int().min(1).default(180),
  /** 前回見直し実施日（ISO 8601） */
  lastReviewedAt: z.string().nullable().default(null),
  /** 次回見直し期限（ISO 8601） */
  nextReviewDueAt: z.string().nullable().default(null),
  /** 見直し理由 */
  reviewReason: z.string().default(''),
}).default({
  reviewCycleDays: 180,
  lastReviewedAt: null,
  nextReviewDueAt: null,
  reviewReason: '',
});

export type IspReviewControl = z.infer<typeof ispReviewControlSchema>;

/** ISP 承認記録スキーマ（F-1: サビ管承認の電子的証跡） */
export const ispApprovalSchema = z.object({
  /** 承認者 UPN (email) */
  approvedBy: z.string().nullable().default(null),
  /** 承認日時 (ISO 8601) */
  approvedAt: z.string().nullable().default(null),
  /** 承認ステータス */
  approvalStatus: z.enum(['draft', 'approved']).default('draft'),
}).default({
  approvedBy: null,
  approvedAt: null,
  approvalStatus: 'draft',
});

export type IspApproval = z.infer<typeof ispApprovalSchema>;

/** ISP コンプライアンスメタデータ（生活介護 ISP の監査対応項目を集約） */
export const ispComplianceMetadataSchema = z.object({
  /** サービス種別 */
  serviceType: z.enum([
    'daily_life_care',
    'residential_support',
    'short_stay',
    'group_home',
    'behavior_support',
    'home_care',
    'other',
  ] as const).default('other'),
  /** 標準的な支援提供時間（時間単位、例: 6.5） */
  standardServiceHours: z.number().min(0).nullable().default(null),
  /** 同意記録詳細 */
  consent: ispConsentDetailSchema,
  /** 交付記録詳細 */
  delivery: ispDeliveryDetailSchema,
  /** 見直し制御 */
  reviewControl: ispReviewControlSchema,
  /** 承認記録（F-1: サビ管承認の電子的証跡） */
  approval: ispApprovalSchema,
}).default({
  serviceType: 'other',
  standardServiceHours: null,
  consent: {
    explainedAt: null,
    explainedBy: '',
    consentedAt: null,
    consentedBy: '',
    proxyName: '',
    proxyRelation: '',
    notes: '',
  },
  delivery: {
    deliveredAt: null,
    deliveredToUser: false,
    deliveredToConsultationSupport: false,
    deliveryMethod: '',
    notes: '',
  },
  reviewControl: {
    reviewCycleDays: 180,
    lastReviewedAt: null,
    nextReviewDueAt: null,
    reviewReason: '',
  },
  approval: {
    approvedBy: null,
    approvedAt: null,
    approvalStatus: 'draft',
  },
});

export type IspComplianceMetadata = z.infer<typeof ispComplianceMetadataSchema>;

// ─────────────────────────────────────────────
// コンプライアンスユーティリティ（A-1 追加）
// ─────────────────────────────────────────────

/**
 * ISP の見直し期限が超過しているかを判定する
 *
 * reviewControl.nextReviewDueAt を基準に判定。
 * 未設定の場合は超過とみなさない（null → false）。
 */
export function isIspReviewOverdue(
  compliance: IspComplianceMetadata | undefined,
  today?: string,
): boolean {
  const dueAt = compliance?.reviewControl?.nextReviewDueAt;
  if (!dueAt) return false;
  const due = new Date(dueAt);
  const now = today ? new Date(today) : new Date();
  const dueUtc = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return nowUtc > dueUtc;
}

/**
 * ISP の見直し期限超過日数を算出する
 *
 * 超過していない場合は 0 を返す。未設定の場合は null。
 */
export function computeIspReviewOverdueDays(
  compliance: IspComplianceMetadata | undefined,
  today?: string,
): number | null {
  const dueAt = compliance?.reviewControl?.nextReviewDueAt;
  if (!dueAt) return null;
  const due = new Date(dueAt);
  const now = today ? new Date(today) : new Date();
  const dueUtc = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.floor((nowUtc - dueUtc) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

/**
 * 標準的な支援提供時間（totalHours）の妥当性を検証する
 *
 * @returns エラーメッセージ（問題なし → null）
 */
export function validateStandardServiceHours(
  hours: number | null | undefined,
): string | null {
  if (hours == null) return null; // 未入力は許容
  if (hours < 0) return '支援提供時間は 0 以上で入力してください';
  if (hours > 24) return '支援提供時間は 24 時間以内で入力してください';
  return null;
}

// ---------------------------------------------------------------------------
// F-1: ISP 承認ドメインロジック
// ---------------------------------------------------------------------------

/** 承認操作の入力 */
export type ApproveIspInput = {
  /** 承認者の UPN (email) */
  approverUpn: string;
  /** 承認日時 (ISO 8601) */
  approvedAt: string;
};

/**
 * approveIsp / canApproveIsp の循環参照回避用 minimal 型。
 * IndividualSupportPlan と格局上互換。
 */
type IspApprovalTarget = {
  status: string;
  compliance?: {
    approval?: { approvalStatus?: string };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

/**
 * ISP を承認する pure function
 *
 * consent_pending ステータスの ISP に対して、
 * サービス管理責任者の承認を記録する。
 *
 * @throws consent_pending 以外 or すでに承認済みの場合
 */
export function approveIsp<T extends IspApprovalTarget>(
  plan: T,
  input: ApproveIspInput,
): T {
  if (!canApproveIsp(plan)) {
    throw new Error(
      `ISP を承認できません (status: ${plan.status}, approvalStatus: ${plan.compliance?.approval?.approvalStatus ?? 'N/A'})`,
    );
  }

  const currentCompliance = plan.compliance ?? ispComplianceMetadataSchema.parse({});

  return {
    ...plan,
    compliance: {
      ...currentCompliance,
      approval: {
        approvedBy: input.approverUpn,
        approvedAt: input.approvedAt,
        approvalStatus: 'approved' as const,
      },
    },
  };
}

/**
 * ISP が承認可能かを判定する guard function
 *
 * 承認可能条件:
 * - status が 'consent_pending'
 * - まだ承認されていない (approvalStatus !== 'approved')
 */
export function canApproveIsp(plan: IspApprovalTarget): boolean {
  const approval = plan.compliance?.approval;
  return (
    plan.status === 'consent_pending' &&
    (!approval || approval.approvalStatus !== 'approved')
  );
}
