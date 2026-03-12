/**
 * 利用者の制度判定プロファイル — Zod スキーマ + 型
 *
 * Users_Master に追加する制度判定関連属性。
 * 行動関連項目点数、障害支援区分、対象サービス種別、
 * 強度行動障害対象判定等を保持する。
 *
 * @see docs/design/isp-three-layer-regulatory-mapping.md
 * @see src/domain/isp/schema.ts (applicableServiceTypeSchema)
 */
import { z } from 'zod';
import { applicableServiceTypeSchema } from '@/domain/isp/schema';

// ─────────────────────────────────────────────
// Zod スキーマ
// ─────────────────────────────────────────────

/**
 * 利用者の制度判定プロファイル
 *
 * Users_Master の既存列と新設列を合わせて、
 * 加算・減算判定に必要な最小限を定義する。
 */
export const userRegulatoryProfileSchema = z.object({
  /** 利用者コード（Users_Master.UserID） */
  userId: z.string().min(1),

  // ── 行動関連項目 ──

  /** 行動関連項目合計点（0〜24）— 国通知12項目×2段階 */
  behaviorScore: z.number().int().min(0).max(24).nullable().default(null),

  /** 児童行動関連項目合計点（児童発達支援用、0以上） */
  childBehaviorScore: z.number().int().min(0).nullable().default(null),

  // ── 障害支援区分 ──

  /** 障害支援区分（既存: DisabilitySupportLevel） */
  disabilitySupportLevel: z.string().nullable().default(null),

  // ── 対象サービス ──

  /** 対象サービス種別の配列 */
  serviceTypes: z.array(applicableServiceTypeSchema).default([]),

  // ── 対象判定 ──

  /**
   * 強度行動障害支援対象フラグ
   * 既存列 IsHighIntensitySupportTarget を再利用
   * 行動関連項目10点以上 かつ 区分4以上 が典型条件
   */
  severeBehaviorSupportEligible: z.boolean().default(false),

  /** 対象判定の最終確認日 */
  eligibilityCheckedAt: z.string().nullable().default(null),
});

export type UserRegulatoryProfile = z.infer<typeof userRegulatoryProfileSchema>;

// ─────────────────────────────────────────────
// SharePoint 列との対応
// ─────────────────────────────────────────────

/**
 * Users_Master に追加する列名マッピング
 *
 * | domain                         | SP internal name              | 方針     |
 * |-------------------------------|------------------------------|---------|
 * | severeBehaviorSupportEligible | IsHighIntensitySupportTarget | 再利用   |
 * | disabilitySupportLevel        | DisabilitySupportLevel       | 再利用   |
 * | behaviorScore                 | BehaviorScore                | 新設     |
 * | childBehaviorScore            | ChildBehaviorScore           | 新設     |
 * | serviceTypes                  | ServiceTypesJson             | 新設 JSON|
 * | eligibilityCheckedAt          | EligibilityCheckedAt         | 新設     |
 */
export const USER_REGULATORY_FIELD_MAP = {
  behaviorScore: 'BehaviorScore',
  childBehaviorScore: 'ChildBehaviorScore',
  serviceTypesJson: 'ServiceTypesJson',
  severeBehaviorSupportEligible: 'IsHighIntensitySupportTarget',  // 再利用
  disabilitySupportLevel: 'DisabilitySupportLevel',               // 再利用
  eligibilityCheckedAt: 'EligibilityCheckedAt',
} as const;

// ─────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────

/**
 * 行動関連項目点数から強度行動障害支援対象の候補かどうかを判定
 * 典型条件: 行動関連項目 10点以上 かつ 障害支援区分 4以上
 *
 * @param score 行動関連項目合計点
 * @param level 障害支援区分 (文字列 "1"〜"6")
 * @returns 対象候補かどうか
 */
export function isSevereBehaviorSupportCandidate(
  score: number | null | undefined,
  level: string | null | undefined,
): boolean {
  if (score == null || score < 10) return false;
  if (level == null) return false;
  const levelNum = parseInt(level, 10);
  return !isNaN(levelNum) && levelNum >= 4;
}
