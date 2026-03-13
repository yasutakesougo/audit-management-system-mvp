// ---------------------------------------------------------------------------
// QualificationAssignment — 配置履歴の型・充足判定
//
// P4: どの職員がどの利用者にいつから配置されているかを記録。
// WeeklyObservationRecord との突合で配置 × 観察の充足を判定する。
// ---------------------------------------------------------------------------

import type { StaffQualification } from '@/domain/isp/schema';

// ---------------------------------------------------------------------------
// Domain Types
// ---------------------------------------------------------------------------

/** 配置種別 */
export const assignmentTypeValues = ['primary', 'sub', 'observation'] as const;
export type AssignmentType = (typeof assignmentTypeValues)[number];

export const ASSIGNMENT_TYPE_LABELS: Record<AssignmentType, string> = {
  primary: '主担当',
  sub: '副担当',
  observation: '観察配置',
} as const;

/** 配置履歴 */
export interface QualificationAssignment {
  /** レコード ID */
  id: string;
  /** 職員 ID */
  staffId: string;
  /** 職員氏名 */
  staffName: string;
  /** 配置対象利用者 ID */
  userId: string;
  /** 配置開始日 (ISO 8601 date) */
  assignedFrom: string;
  /** 配置終了日 (ISO 8601 date, 空 = 継続中) */
  assignedTo?: string;
  /** 配置種別 */
  assignmentType: AssignmentType;
  /** 配置に必要な資格水準（将来拡張用） */
  requiredQualification?: StaffQualification;
  /** 備考 */
  notes: string;
  /** 登録者 */
  registeredBy: string;
  /** 登録日時 (ISO 8601) */
  registeredAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * 配置がアクティブ（終了日が設定されていない or 未来）かを判定する。
 */
export function isAssignmentActive(
  assignment: QualificationAssignment,
  today?: string,
): boolean {
  if (!assignment.assignedTo) return true;
  const now = today ?? new Date().toISOString().slice(0, 10);
  return assignment.assignedTo >= now;
}

/**
 * 職員のアクティブな配置を取得する。
 */
export function getActiveAssignments(
  assignments: QualificationAssignment[],
  staffId: string,
  today?: string,
): QualificationAssignment[] {
  return assignments.filter(
    (a) => a.staffId === staffId && isAssignmentActive(a, today),
  );
}

/**
 * 利用者に配置されているアクティブな職員を取得する。
 */
export function getAssignmentsByUser(
  assignments: QualificationAssignment[],
  userId: string,
  today?: string,
): QualificationAssignment[] {
  return assignments.filter(
    (a) => a.userId === userId && isAssignmentActive(a, today),
  );
}
