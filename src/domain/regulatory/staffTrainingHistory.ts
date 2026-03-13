// ---------------------------------------------------------------------------
// StaffTrainingHistory — 研修修了履歴の型・ヘルパー
//
// P4: StaffQualificationProfile の bool フラグの「証跡原本」。
// いつ・どこで・何の研修を修了したかを記録する。
// ---------------------------------------------------------------------------

import type { StaffQualification } from '@/domain/isp/schema';

// ---------------------------------------------------------------------------
// Domain Types
// ---------------------------------------------------------------------------

/** 研修修了履歴 */
export interface StaffTrainingHistory {
  /** レコード ID */
  id: string;
  /** 職員 ID */
  staffId: string;
  /** 職員氏名 */
  staffName: string;

  // ── 研修情報 ──

  /** 研修種別（既存 staffQualificationValues を再利用） */
  trainingType: StaffQualification;
  /** 修了日 (ISO 8601 date) */
  completedAt: string;
  /** 修了証番号 */
  certificateNumber: string;
  /** 研修実施機関 */
  issuingOrganization: string;
  /** 有効期限 (ISO 8601 date, 任意) */
  expiresAt?: string;

  // ── メタ ──

  /** 登録者 */
  registeredBy: string;
  /** 登録日時 (ISO 8601) */
  registeredAt: string;
}

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

/** 研修種別ラベル（schema.ts の STAFF_QUALIFICATION_DISPLAY と併用） */
export const TRAINING_TYPE_SHORT_LABELS: Record<StaffQualification, string> = {
  practical_training: '実践',
  basic_training: '基礎',
  behavior_guidance_training: '行動援護',
  core_person_training: '中核的人材',
  other: 'その他',
  unknown: '不明',
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 職員の修了履歴から、修了済み研修種別のセットを返す。
 */
export function getCompletedTrainingTypes(
  records: StaffTrainingHistory[],
): Set<StaffQualification> {
  return new Set(records.map((r) => r.trainingType));
}

/**
 * 有効期限切れの修了履歴を検出する。
 */
export function getExpiredTrainings(
  records: StaffTrainingHistory[],
  today?: string,
): StaffTrainingHistory[] {
  const now = today ?? new Date().toISOString().slice(0, 10);
  return records.filter(
    (r) => r.expiresAt && r.expiresAt < now,
  );
}

/**
 * 修了証跡が未登録の研修種別を検出する。
 *
 * @param profileFlags - StaffQualificationProfile の bool フラグから得た研修セット
 * @param records - 実際の修了履歴
 * @returns 証跡が欠落している研修種別
 */
export function getMissingCertificates(
  profileFlags: Set<StaffQualification>,
  records: StaffTrainingHistory[],
): StaffQualification[] {
  const completed = getCompletedTrainingTypes(records);
  const missing: StaffQualification[] = [];

  for (const flag of profileFlags) {
    if (!completed.has(flag)) {
      missing.push(flag);
    }
  }

  return missing;
}
