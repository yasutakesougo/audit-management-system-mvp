/**
 * 職員の資格判定プロファイル — Zod スキーマ + 型
 *
 * Staff_Master に追加する制度判定関連属性。
 * 強度行動障害関連の研修修了フラグと、
 * 加算判定に必要な資格情報を保持する。
 *
 * @see docs/design/isp-three-layer-regulatory-mapping.md
 * @see src/domain/isp/schema.ts (staffQualificationSchema)
 */
import { z } from 'zod';
import { staffQualificationSchema } from '@/domain/isp/schema';

// ─────────────────────────────────────────────
// Zod スキーマ
// ─────────────────────────────────────────────

/**
 * 職員の資格判定プロファイル
 *
 * Staff_Master の既存列 (Certifications) を温存しつつ、
 * 研修修了を検索・判定しやすい bool 列で管理する。
 */
export const staffQualificationProfileSchema = z.object({
  /** 職員コード（Staff_Master.StaffID） */
  staffId: z.string().min(1),

  // ── 研修修了フラグ ──

  /** 強度行動障害支援者養成研修（実践研修）修了 */
  hasPracticalTraining: z.boolean().default(false),

  /** 強度行動障害支援者養成研修（基礎研修）修了 */
  hasBasicTraining: z.boolean().default(false),

  /** 行動援護従業者養成研修修了 */
  hasBehaviorGuidanceTraining: z.boolean().default(false),

  /** 中核的人材養成研修修了 */
  hasCorePersonTraining: z.boolean().default(false),

  // ── メタデータ ──

  /** 資格情報の最終確認日 */
  certificationCheckedAt: z.string().nullable().default(null),
});

export type StaffQualificationProfile = z.infer<typeof staffQualificationProfileSchema>;

// ─────────────────────────────────────────────
// SharePoint 列との対応
// ─────────────────────────────────────────────

/**
 * Staff_Master に追加する列名マッピング
 *
 * | domain                      | SP internal name            | 方針   |
 * |----------------------------|-----------------------------|--------|
 * | hasPracticalTraining       | HasPracticalTraining        | 新設   |
 * | hasBasicTraining           | HasBasicTraining            | 新設   |
 * | hasBehaviorGuidanceTraining| HasBehaviorGuidanceTraining | 新設   |
 * | hasCorePersonTraining      | HasCorePersonTraining       | 新設   |
 * | certificationCheckedAt     | CertificationCheckedAt      | 新設   |
 * | (既存 Certifications)       | Certifications              | 温存   |
 */
export const STAFF_REGULATORY_FIELD_MAP = {
  hasPracticalTraining: 'HasPracticalTraining',
  hasBasicTraining: 'HasBasicTraining',
  hasBehaviorGuidanceTraining: 'HasBehaviorGuidanceTraining',
  hasCorePersonTraining: 'HasCorePersonTraining',
  certificationCheckedAt: 'CertificationCheckedAt',
} as const;

// ─────────────────────────────────────────────
// ユーティリティ
// ─────────────────────────────────────────────

/**
 * 職員の最高資格区分を判定する
 *
 * 優先順位: core_person > practical > behavior_guidance > basic > other > unknown
 */
export function resolveHighestQualification(
  profile: StaffQualificationProfile,
): z.infer<typeof staffQualificationSchema> {
  if (profile.hasCorePersonTraining) return 'core_person_training';
  if (profile.hasPracticalTraining) return 'practical_training';
  if (profile.hasBehaviorGuidanceTraining) return 'behavior_guidance_training';
  if (profile.hasBasicTraining) return 'basic_training';
  return 'unknown';
}

/**
 * 支援計画シート作成要件を満たすかどうかを判定
 *
 * 重度障害者支援加算（生活介護等）の条件:
 * 実践研修修了者 または 中核的人材 が含まれること
 */
export function meetsAuthoringRequirement(profile: StaffQualificationProfile): boolean {
  return profile.hasPracticalTraining || profile.hasCorePersonTraining;
}

// ─────────────────────────────────────────────
// SPS 確定権限判定
// ─────────────────────────────────────────────

/**
 * SPS 確定要件を満たすかどうかを判定
 *
 * 現行の制度要件: 実践研修修了者 または 中核的人材
 *
 * 作成要件（meetsAuthoringRequirement）と現時点で同一だが、
 * 「作成」と「確定」は制度上の別責務であるため関数を分離する。
 *
 * @see ibdStore.canConfirmSPS — Shadow Model 側の旧実装（実践研修のみで判定していた）
 */
export function meetsConfirmationRequirement(profile: StaffQualificationProfile): boolean {
  return profile.hasPracticalTraining || profile.hasCorePersonTraining;
}

/** SPS確定権限の判定結果 */
export interface SPSConfirmationEligibility {
  eligible: boolean;
  reasonCodes: SPSConfirmationReasonCode[];
  missingQualifications: string[];
}

export type SPSConfirmationReasonCode =
  | 'no_practical_training'
  | 'no_core_person_training';

/**
 * SPS確定操作の権限判定（説明可能な結果を返す）
 *
 * ibdStore.canConfirmSPS の domain 側移植。
 * bool ではなく構造化された結果を返し、
 * UI 表示・監査 finding 両方に使える。
 *
 * @param profile 操作者の資格プロファイル
 */
export function checkSPSConfirmationEligibility(
  profile: StaffQualificationProfile,
): SPSConfirmationEligibility {
  if (meetsConfirmationRequirement(profile)) {
    return { eligible: true, reasonCodes: [], missingQualifications: [] };
  }

  const reasonCodes: SPSConfirmationReasonCode[] = [];
  const missingQualifications: string[] = [];

  if (!profile.hasPracticalTraining) {
    reasonCodes.push('no_practical_training');
    missingQualifications.push('強度行動障害支援者養成研修（実践研修）');
  }
  if (!profile.hasCorePersonTraining) {
    reasonCodes.push('no_core_person_training');
    missingQualifications.push('中核的人材養成研修');
  }

  return { eligible: false, reasonCodes, missingQualifications };
}
