// ---------------------------------------------------------------------------
// WeeklyObservation — 週次観察・助言記録の型・充足判定
//
// P4: 中核的人材による週1回の観察・助言を記録。
// QualificationAssignment と突合して充足率を算出する。
//
// 制度根拠:
//   重度障害者支援加算 — 中核的人材配置加算算定要件として
//   「週1回以上の専門的助言」が求められる。
// ---------------------------------------------------------------------------

import type { QualificationAssignment } from './qualificationAssignment';
import { isAssignmentActive } from './qualificationAssignment';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** 週次観察の充足率閾値（80%以上で充足とする） */
export const WEEKLY_OBSERVATION_FULFILLMENT_THRESHOLD = 0.8;

// ---------------------------------------------------------------------------
// Domain Types
// ---------------------------------------------------------------------------

/** 週次観察・助言記録 */
export interface WeeklyObservationRecord {
  /** レコード ID */
  id: string;
  /** 観察者 ID（中核的人材） */
  observerId: string;
  /** 観察者氏名 */
  observerName: string;
  /** 観察対象職員 ID */
  targetStaffId: string;
  /** 観察対象職員氏名 */
  targetStaffName: string;
  /** 対象利用者 ID */
  userId: string;
  /** 観察日 (ISO 8601 date) */
  observationDate: string;
  /** 観察内容 */
  observationContent: string;
  /** 助言内容 */
  adviceContent: string;
  /** 次回までのフォロー事項 */
  followUpActions: string;
  /** 記録者 */
  recordedBy: string;
  /** 記録日時 (ISO 8601) */
  recordedAt: string;
}

// ---------------------------------------------------------------------------
// 充足判定
// ---------------------------------------------------------------------------

/** 充足判定結果 */
export interface ObservationFulfillment {
  /** 充足しているか */
  fulfilled: boolean;
  /** 期待される回数 */
  expected: number;
  /** 実績回数 */
  actual: number;
  /** 不足回数 */
  gap: number;
  /** 充足率 (0.0 - 1.0+) */
  rate: number;
}

/**
 * 2つの日付間の完了した週数を計算する。
 * 配置開始週は含む。未来日は除外。
 */
export function computeExpectedWeeks(
  fromDate: string,
  toDate: string,
): number {
  const from = new Date(fromDate);
  const to = new Date(toDate);
  if (from >= to) return 0;
  const diffMs = to.getTime() - from.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.floor(diffDays / 7));
}

/**
 * assignment に対する週次観察の充足判定を行う。
 *
 * @param assignment - 配置履歴
 * @param observations - 該当する観察記録
 * @param today - 判定基準日
 */
export function evaluateObservationFulfillment(
  assignment: QualificationAssignment,
  observations: WeeklyObservationRecord[],
  today?: string,
): ObservationFulfillment {
  const now = today ?? new Date().toISOString().slice(0, 10);

  // 配置終了日がある場合はそちらか今日の早い方
  const endDate = assignment.assignedTo && assignment.assignedTo < now
    ? assignment.assignedTo
    : now;

  const expected = computeExpectedWeeks(assignment.assignedFrom, endDate);

  // この assignment に該当する観察記録をフィルタ
  const relevant = observations.filter(
    (o) =>
      o.targetStaffId === assignment.staffId &&
      o.userId === assignment.userId &&
      o.observationDate >= assignment.assignedFrom &&
      o.observationDate <= endDate,
  );

  const actual = relevant.length;
  const rate = expected > 0 ? actual / expected : 1;

  return {
    fulfilled: rate >= WEEKLY_OBSERVATION_FULFILLMENT_THRESHOLD,
    expected,
    actual,
    gap: Math.max(0, expected - actual),
    rate,
  };
}

/**
 * 直近の観察記録からの経過日数を算出する。
 * 助言記録がない場合はnullを返す。
 */
export function daysSinceLastObservation(
  observations: WeeklyObservationRecord[],
  staffId: string,
  userId: string,
  today?: string,
): number | null {
  const now = today ?? new Date().toISOString().slice(0, 10);
  const relevant = observations
    .filter((o) => o.targetStaffId === staffId && o.userId === userId)
    .sort((a, b) => b.observationDate.localeCompare(a.observationDate));

  if (relevant.length === 0) return null;

  const last = new Date(relevant[0].observationDate);
  const current = new Date(now);
  return Math.floor((current.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// サマリ
// ---------------------------------------------------------------------------

/** 職員資格サマリ（管理画面用） */
export interface StaffQualificationSummary {
  /** 修了証跡数 */
  totalCertificates: number;
  /** 修了証跡未登録件数（profileのフラグありだが証跡なし） */
  missingCertificates: number;
  /** アクティブ配置数 */
  activeAssignments: number;
  /** 資格未充足配置件数 */
  unqualifiedAssignments: number;
  /** 観察充足の配置数 */
  fulfilledObservations: number;
  /** 観察不足の配置数 */
  shortageObservations: number;
  /** 30日以上助言なしの件数 */
  overdueCorePersonAdvice: number;
}

/**
 * 職員資格サマリを算出する。
 */
export function computeStaffQualificationSummary(params: {
  certificates: number;
  missingCertificates: number;
  assignments: QualificationAssignment[];
  observations: WeeklyObservationRecord[];
  corePersonAssignments: QualificationAssignment[];
  today?: string;
}): StaffQualificationSummary {
  const {
    certificates,
    missingCertificates,
    assignments,
    observations,
    corePersonAssignments,
    today,
  } = params;
  const now = today ?? new Date().toISOString().slice(0, 10);

  const active = assignments.filter((a) => isAssignmentActive(a, now));

  let fulfilledCount = 0;
  let shortageCount = 0;

  for (const a of active) {
    const result = evaluateObservationFulfillment(a, observations, now);
    if (result.fulfilled) fulfilledCount++;
    else shortageCount++;
  }

  // 30日以上助言なし
  let overdueCount = 0;
  for (const a of corePersonAssignments.filter((ca) => isAssignmentActive(ca, now))) {
    const days = daysSinceLastObservation(observations, a.staffId, a.userId, now);
    if (days === null || days > 30) overdueCount++;
  }

  return {
    totalCertificates: certificates,
    missingCertificates,
    activeAssignments: active.length,
    unqualifiedAssignments: 0, // auditChecks側で判定
    fulfilledObservations: fulfilledCount,
    shortageObservations: shortageCount,
    overdueCorePersonAdvice: overdueCount,
  };
}
