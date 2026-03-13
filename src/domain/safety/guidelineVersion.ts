// ---------------------------------------------------------------------------
// GuidelineVersion — 指針版管理のドメイン型
//
// 身体拘束等適正化のための指針のバージョン管理。
// 運営基準では指針の策定と定期的な見直しが義務付けられている。
//
// 法的根拠:
//   - 障害者の日常生活及び社会生活を総合的に支援するための法律
//   - 指定基準省令 — 身体拘束等適正化のための指針の整備
//   - 厚労省通知: 指針に含むべき事項の規定
// ---------------------------------------------------------------------------

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Enum Values
// ---------------------------------------------------------------------------

/** 指針のステータス */
export const guidelineStatusValues = ['draft', 'active', 'archived'] as const;
export type GuidelineStatus = (typeof guidelineStatusValues)[number];

/** 変更の種別 */
export const changeTypeValues = [
  '新規策定',
  '定期見直し',
  '法令改正対応',
  '事故・ヒヤリハット対応',
  '委員会決定',
  'その他',
] as const;
export type ChangeType = (typeof changeTypeValues)[number];

// ---------------------------------------------------------------------------
// GuidelineVersion
// ---------------------------------------------------------------------------

export type GuidelineVersion = {
  id: string;

  // ── バージョン情報 ──
  /** バージョン番号 (例: "1.0", "2.1") */
  version: string;
  /** 指針のタイトル */
  title: string;

  // ── コンテンツ ──
  /** 指針の主要内容（テキスト形式） */
  content: string;
  /** 変更の種別 */
  changeType: ChangeType;
  /** 変更理由・概要 */
  changeReason: string;

  // ── 必須項目チェック ──
  /**
   * 指針に含むべき事項（厚労省通知準拠）
   * true = 含まれている
   */
  requiredItems: GuidelineRequiredItems;

  // ── 施行・管理 ──
  /** 施行日 (ISO 8601 date) */
  effectiveDate: string;
  /** ステータス */
  status: GuidelineStatus;

  // ── メタ ──
  /** 作成者 */
  createdBy: string;
  /** 作成日時 (ISO 8601) */
  createdAt: string;
  /** 承認者 */
  approvedBy?: string;
  /** 承認日時 (ISO 8601) */
  approvedAt?: string;
};

/** 指針に含むべき必須事項（厚労省通知に基づく） */
export type GuidelineRequiredItems = {
  /** 身体拘束等を行う場合の手続き */
  procedureForRestraint: boolean;
  /** 身体拘束等の適正化のための体制（委員会設置等） */
  organizationalStructure: boolean;
  /** 身体拘束等の適正化のための職員研修 */
  staffTrainingPolicy: boolean;
  /** 身体拘束等を実施した場合の報告方法・様式 */
  reportingProcedure: boolean;
  /** 三要件の確認方法 */
  threeRequirementsVerification: boolean;
  /** 身体拘束等を行った場合の利用者への説明方法 */
  userExplanationMethod: boolean;
  /** 身体拘束等の見直し・解除のプロセス */
  reviewReleaseProcess: boolean;
};

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------

const requiredItemsSchema = z.object({
  procedureForRestraint: z.boolean().default(false),
  organizationalStructure: z.boolean().default(false),
  staffTrainingPolicy: z.boolean().default(false),
  reportingProcedure: z.boolean().default(false),
  threeRequirementsVerification: z.boolean().default(false),
  userExplanationMethod: z.boolean().default(false),
  reviewReleaseProcess: z.boolean().default(false),
});

export const guidelineVersionDraftSchema = z.object({
  version: z.string().default('1.0'),
  title: z.string().default('身体拘束等適正化のための指針'),
  content: z.string().default(''),
  changeType: z.enum(changeTypeValues).default('新規策定'),
  changeReason: z.string().default(''),
  requiredItems: requiredItemsSchema.default({
    procedureForRestraint: false,
    organizationalStructure: false,
    staffTrainingPolicy: false,
    reportingProcedure: false,
    threeRequirementsVerification: false,
    userExplanationMethod: false,
    reviewReleaseProcess: false,
  }),
  effectiveDate: z.string().default(() => new Date().toISOString().slice(0, 10)),
  createdBy: z.string().default(''),
});

export type GuidelineVersionDraft = z.infer<typeof guidelineVersionDraftSchema>;

// ---------------------------------------------------------------------------
// Domain Helpers
// ---------------------------------------------------------------------------

/** Draft から GuidelineVersion に変換する */
export function fromDraftToGuidelineVersion(
  id: string,
  draft: GuidelineVersionDraft,
): GuidelineVersion {
  return {
    id,
    version: draft.version,
    title: draft.title,
    content: draft.content,
    changeType: draft.changeType,
    changeReason: draft.changeReason,
    requiredItems: { ...draft.requiredItems },
    effectiveDate: draft.effectiveDate,
    status: 'draft',
    createdBy: draft.createdBy,
    createdAt: new Date().toISOString(),
  };
}

/** 空の Draft を生成する */
export function createEmptyGuidelineDraft(
  createdBy?: string,
): GuidelineVersionDraft {
  return guidelineVersionDraftSchema.parse({
    createdBy: createdBy ?? '',
  });
}

/** 必須項目の充足数を計算する */
export function countFulfilledRequiredItems(items: GuidelineRequiredItems): number {
  return Object.values(items).filter(Boolean).length;
}

/** 必須項目の総数 */
export const TOTAL_REQUIRED_ITEMS = 7;

/** 必須項目がすべて充足されているか */
export function allRequiredItemsFulfilled(items: GuidelineRequiredItems): boolean {
  return countFulfilledRequiredItems(items) === TOTAL_REQUIRED_ITEMS;
}

/** 必須項目のラベルマップ */
export const REQUIRED_ITEM_LABELS: Record<keyof GuidelineRequiredItems, string> = {
  procedureForRestraint: '身体拘束等を行う場合の手続き',
  organizationalStructure: '適正化のための体制（委員会設置等）',
  staffTrainingPolicy: '職員研修に関する方針',
  reportingProcedure: '実施した場合の報告方法・様式',
  threeRequirementsVerification: '三要件の確認方法',
  userExplanationMethod: '利用者への説明方法',
  reviewReleaseProcess: '見直し・解除のプロセス',
};

// ---------------------------------------------------------------------------
// Summary Types (for dashboard aggregation)
// ---------------------------------------------------------------------------

export type GuidelineSummary = {
  /** 総バージョン数 */
  totalVersions: number;
  /** 現行版のバージョン番号 */
  currentVersion: string | null;
  /** 現行版の施行日 */
  currentEffectiveDate: string | null;
  /** 現行版の必須項目充足数 */
  currentFulfilledItems: number;
  /** 現行版の必須項目充足率 (%) */
  currentFulfillmentRate: number;
  /** 全必須項目が充足されているか */
  allItemsFulfilled: boolean;
  /** 最終更新日 */
  lastUpdatedAt: string | null;
};

/** GuidelineVersion[] からサマリーを算出する */
export function computeGuidelineSummary(
  versions: GuidelineVersion[],
): GuidelineSummary {
  // active のものを施行日順でソート（最新が先頭）
  const activeVersions = versions
    .filter((v) => v.status === 'active')
    .sort((a, b) => new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime());

  const current = activeVersions[0] ?? null;

  const fulfilledCount = current ? countFulfilledRequiredItems(current.requiredItems) : 0;

  return {
    totalVersions: versions.length,
    currentVersion: current?.version ?? null,
    currentEffectiveDate: current?.effectiveDate ?? null,
    currentFulfilledItems: fulfilledCount,
    currentFulfillmentRate: Math.round((fulfilledCount / TOTAL_REQUIRED_ITEMS) * 100),
    allItemsFulfilled: current ? allRequiredItemsFulfilled(current.requiredItems) : false,
    lastUpdatedAt: current?.createdAt ?? null,
  };
}
