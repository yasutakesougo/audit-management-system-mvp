/**
 * 監査判定 — 純関数群
 *
 * 制度上のリスクと未整備状態を検出する。
 * UI や Repository に依存しない純粋なビジネスロジック。
 *
 * @see docs/design/isp-three-layer-regulatory-mapping.md
 */

import type { UserRegulatoryProfile } from './userRegulatoryProfile';
import type { StaffQualificationProfile } from './staffQualificationProfile';
import { isSevereBehaviorSupportCandidate } from './userRegulatoryProfile';
import { meetsAuthoringRequirement, resolveHighestQualification } from './staffQualificationProfile';

// ─────────────────────────────────────────────
// 型定義
// ─────────────────────────────────────────────

export const AUDIT_FINDING_TYPES = [
  'planning_sheet_missing',
  'author_qualification_missing',
  'review_overdue',
  'procedure_record_gap',
  'delivery_missing',
  'add_on_candidate',
  'monitoring_meeting_missing',
  'monitoring_meeting_unfinalized',
  'monitoring_qualification_missing',
  'monitoring_overdue',
] as const;

export type AuditFindingType = typeof AUDIT_FINDING_TYPES[number];

export const AUDIT_FINDING_TYPE_LABELS: Record<AuditFindingType, string> = {
  planning_sheet_missing: '支援計画シート未作成',
  author_qualification_missing: '作成者資格不足',
  review_overdue: '見直し期限超過',
  procedure_record_gap: '実施記録不足',
  delivery_missing: '交付未完了',
  add_on_candidate: '加算算定候補',
  monitoring_meeting_missing: 'モニタリング未実施',
  monitoring_meeting_unfinalized: 'モニタリング未確定',
  monitoring_qualification_missing: 'モニタリング資格不足',
  monitoring_overdue: 'モニタリング期限超過',
};

export const AUDIT_FINDING_SEVERITIES = ['high', 'medium', 'low'] as const;
export type AuditFindingSeverity = typeof AUDIT_FINDING_SEVERITIES[number];

export interface AuditFinding {
  id: string;
  type: AuditFindingType;
  severity: AuditFindingSeverity;
  userId: string;
  userName?: string;
  planningSheetId?: string;
  ispId?: string;
  message: string;
  /** 期限超過日数（負の値 = 超過） */
  overdueDays?: number;
  dueDate?: string;
  detectedAt: string;
}

// ─────────────────────────────────────────────
// 判定入力型
// ─────────────────────────────────────────────

/** 支援計画シートの監査判定に必要な最小情報 */
export interface SheetAuditInfo {
  id: string;
  userId: string;
  title: string;
  authoredByStaffId?: string;
  authoredByQualification?: string;
  applicableAddOnTypes?: string[];
  nextReviewAt?: string | null;
  deliveredToUserAt?: string | null;
  status: string;
  isCurrent: boolean;
}

/** 手順記録の監査判定に必要な最小情報 */
export interface RecordAuditInfo {
  id: string;
  planningSheetId: string;
  recordDate: string;
}

/** モニタリング会議の監査判定に必要な最小情報 */
export interface MonitoringAuditInfo {
  id: string;
  userId: string;
  meetingDate: string;
  status: 'draft' | 'finalized';
  qualificationStatus: 'ok' | 'warning' | 'invalid';
  hasBasicTrainedMember: boolean;
  hasPracticalTrainedMember: boolean;
}

// ─────────────────────────────────────────────
// 判定関数
// ─────────────────────────────────────────────

let _findingCounter = 0;
function nextFindingId(): string {
  _findingCounter += 1;
  return `finding-${_findingCounter}`;
}

/** テスト用: カウンタリセット */
export function _resetFindingCounter(): void {
  _findingCounter = 0;
}

/**
 * 1. 支援計画シート未作成リスク
 *
 * 条件: 強度行動障害対象候補 かつ 現行シートなし
 */
export function getPlanningSheetMissingRisk(
  userProfile: UserRegulatoryProfile,
  currentSheets: SheetAuditInfo[],
  today: string,
): AuditFinding | null {
  const isCandidate = isSevereBehaviorSupportCandidate(
    userProfile.behaviorScore,
    userProfile.disabilitySupportLevel,
  );
  if (!isCandidate) return null;

  const hasCurrent = currentSheets.some(s => s.isCurrent && s.status !== 'archived');
  if (hasCurrent) return null;

  return {
    id: nextFindingId(),
    type: 'planning_sheet_missing',
    severity: 'high',
    userId: userProfile.userId,
    message: `行動関連項目 ${userProfile.behaviorScore}点・区分${userProfile.disabilitySupportLevel} — 支援計画シートが未作成です`,
    detectedAt: today,
  };
}

/**
 * 2. 作成者資格不足リスク
 *
 * 条件: 現行シートあり かつ 作成者が実践研修/中核的人材でない
 */
export function getAuthorQualificationRisk(
  sheet: SheetAuditInfo,
  staffProfile: StaffQualificationProfile | null,
  today: string,
): AuditFinding | null {
  if (!sheet.isCurrent || sheet.status === 'archived') return null;
  if (!staffProfile) {
    return {
      id: nextFindingId(),
      type: 'author_qualification_missing',
      severity: 'high',
      userId: sheet.userId,
      planningSheetId: sheet.id,
      message: `「${sheet.title}」の作成者が未登録です`,
      detectedAt: today,
    };
  }

  if (meetsAuthoringRequirement(staffProfile)) return null;

  const highest = resolveHighestQualification(staffProfile);
  return {
    id: nextFindingId(),
    type: 'author_qualification_missing',
    severity: 'medium',
    userId: sheet.userId,
    planningSheetId: sheet.id,
    message: `「${sheet.title}」の作成者は${highest === 'unknown' ? '研修未修了' : highest}のみ — 実践研修修了者が必要です`,
    detectedAt: today,
  };
}

/**
 * 3. 見直し期限超過リスク
 *
 * 条件: nextReviewAt < today
 */
export function getReviewOverdueRisk(
  sheet: SheetAuditInfo,
  today: string,
): AuditFinding | null {
  if (!sheet.isCurrent || sheet.status === 'archived') return null;
  if (!sheet.nextReviewAt) return null;

  const due = new Date(sheet.nextReviewAt);
  const now = new Date(today);
  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays >= 0) return null;

  return {
    id: nextFindingId(),
    type: 'review_overdue',
    severity: diffDays <= -30 ? 'high' : 'medium',
    userId: sheet.userId,
    planningSheetId: sheet.id,
    message: `「${sheet.title}」の見直し期限が${Math.abs(diffDays)}日超過しています`,
    overdueDays: diffDays,
    dueDate: sheet.nextReviewAt,
    detectedAt: today,
  };
}

/**
 * 4. 手順記録の空白リスク
 *
 * 条件: 現行シートあり かつ 直近 N日間に記録なし
 */
export function getProcedureRecordGapRisk(
  sheet: SheetAuditInfo,
  records: RecordAuditInfo[],
  today: string,
  gapThresholdDays = 14,
): AuditFinding | null {
  if (!sheet.isCurrent || sheet.status === 'archived') return null;

  const sheetRecords = records.filter(r => r.planningSheetId === sheet.id);

  if (sheetRecords.length === 0) {
    return {
      id: nextFindingId(),
      type: 'procedure_record_gap',
      severity: 'high',
      userId: sheet.userId,
      planningSheetId: sheet.id,
      message: `「${sheet.title}」に対応する実施記録がありません`,
      detectedAt: today,
    };
  }

  const latestDate = sheetRecords
    .map(r => r.recordDate)
    .sort()
    .pop()!;

  const latestMs = new Date(latestDate).getTime();
  const todayMs = new Date(today).getTime();
  const gapDays = Math.floor((todayMs - latestMs) / (1000 * 60 * 60 * 24));

  if (gapDays < gapThresholdDays) return null;

  return {
    id: nextFindingId(),
    type: 'procedure_record_gap',
    severity: gapDays >= 30 ? 'high' : 'medium',
    userId: sheet.userId,
    planningSheetId: sheet.id,
    message: `「${sheet.title}」の直近記録から${gapDays}日間空白（閾値${gapThresholdDays}日）`,
    detectedAt: today,
  };
}

/**
 * 5. 交付未完了リスク
 *
 * 条件: active シート かつ deliveredToUserAt が null
 */
export function getDeliveryMissingRisk(
  sheet: SheetAuditInfo,
  today: string,
): AuditFinding | null {
  if (!sheet.isCurrent || sheet.status !== 'active') return null;
  if (sheet.deliveredToUserAt) return null;

  return {
    id: nextFindingId(),
    type: 'delivery_missing',
    severity: 'medium',
    userId: sheet.userId,
    planningSheetId: sheet.id,
    message: `「${sheet.title}」が運用中ですが本人への交付が未完了です`,
    detectedAt: today,
  };
}

/**
 * 6. 加算算定候補
 *
 * 条件: 対象加算あり かつ 全要件充足
 */
export function getAddOnCandidateFindings(
  sheet: SheetAuditInfo,
  staffProfile: StaffQualificationProfile | null,
  today: string,
): AuditFinding | null {
  if (!sheet.isCurrent || sheet.status !== 'active') return null;
  if (!sheet.applicableAddOnTypes || sheet.applicableAddOnTypes.length === 0) return null;
  if (sheet.applicableAddOnTypes.length === 1 && sheet.applicableAddOnTypes[0] === 'none') return null;
  if (!staffProfile || !meetsAuthoringRequirement(staffProfile)) return null;
  if (!sheet.deliveredToUserAt) return null;

  const addOns = sheet.applicableAddOnTypes.filter(a => a !== 'none');
  return {
    id: nextFindingId(),
    type: 'add_on_candidate',
    severity: 'low',
    userId: sheet.userId,
    planningSheetId: sheet.id,
    message: `「${sheet.title}」は ${addOns.join('・')} の算定要件を充足しています`,
    detectedAt: today,
  };
}

/**
 * 7. モニタリング未実施・未確定・資格不足リスク
 * 
 * 条件: 
 * - 実施なし
 * - 実施済みだが status='draft'
 * - qualificationStatus !== 'ok'
 * - 直近実施から 3ヶ月(or 6ヶ月)経過
 */
export function getMonitoringFindings(
  userProfile: UserRegulatoryProfile,
  meetings: MonitoringAuditInfo[] = [],
  today: string,
  overdueMonths = 3,
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const userMeetings = (meetings || []).filter(m => m.userId === userProfile.userId);

  // 1. 未実施チェック
  if (userMeetings.length === 0) {
    findings.push({
      id: nextFindingId(),
      type: 'monitoring_meeting_missing',
      severity: 'high',
      userId: userProfile.userId,
      message: 'モニタリング会議の記録が一度も作成されていません',
      detectedAt: today,
    });
    return findings;
  }

  // 2. 未確定チェック
  const drafts = userMeetings.filter(m => m.status === 'draft');
  for (const draft of drafts) {
    findings.push({
      id: nextFindingId(),
      type: 'monitoring_meeting_unfinalized',
      severity: 'medium',
      userId: userProfile.userId,
      message: `モニタリング会議（${draft.meetingDate}）が下書きのままです。確定させてください。`,
      detectedAt: today,
    });
  }

  // 3. 資格不足チェック
  const qualificationIssues = userMeetings.filter(m => m.qualificationStatus === 'invalid');
  for (const issue of qualificationIssues) {
    findings.push({
      id: nextFindingId(),
      type: 'monitoring_qualification_missing',
      severity: 'high',
      userId: userProfile.userId,
      message: `モニタリング会議（${issue.meetingDate}）の参加者が、強度行動障害の研修要件を満たしていません。`,
      detectedAt: today,
    });
  }

  // 4. 期限超過チェック
  const finalized = userMeetings.filter(m => m.status === 'finalized');
  if (finalized.length > 0) {
    const latest = finalized.sort((a, b) => b.meetingDate.localeCompare(a.meetingDate))[0];
    const lastDate = new Date(latest.meetingDate);
    const todayDate = new Date(today);
    
    // 簡易的な月数計算
    const diffMonths = (todayDate.getFullYear() - lastDate.getFullYear()) * 12 + (todayDate.getMonth() - lastDate.getMonth());
    
    if (diffMonths >= overdueMonths) {
      findings.push({
        id: nextFindingId(),
        type: 'monitoring_overdue',
        severity: diffMonths >= 6 ? 'high' : 'medium',
        userId: userProfile.userId,
        message: `直近のモニタリング（${latest.meetingDate}）から${diffMonths}ヶ月経過しています（推奨：${overdueMonths}ヶ月以内）`,
        detectedAt: today,
      });
    }
  }

  return findings;
}

// ─────────────────────────────────────────────
// バンドルビルダー
// ─────────────────────────────────────────────

export interface AuditCheckInput {
  userProfile: UserRegulatoryProfile;
  sheets: SheetAuditInfo[];
  staffProfiles: Map<string, StaffQualificationProfile>;
  records: RecordAuditInfo[];
  monitoringMeetings: MonitoringAuditInfo[];
  today: string;
  recordGapThresholdDays?: number;
}

/**
 * 利用者単位ですべての監査判定を実行し、finding 一覧を返す
 */
export function buildRegulatoryFindings(input: AuditCheckInput): AuditFinding[] {
  const { userProfile, sheets, staffProfiles, records, monitoringMeetings, today, recordGapThresholdDays } = input;
  const findings: AuditFinding[] = [];

  const safeSheets = sheets || [];
  const safeRecords = records || [];
  const safeMeetings = monitoringMeetings || [];

  // 1. シート未作成
  const missingRisk = getPlanningSheetMissingRisk(userProfile, safeSheets, today);
  if (missingRisk) findings.push(missingRisk);

  // 現行シートごとにチェック
  const currentSheets = safeSheets.filter(s => s.isCurrent && s.status !== 'archived');
  for (const sheet of currentSheets) {
    // 2. 資格不足
    const staffProfile = sheet.authoredByStaffId && staffProfiles
      ? staffProfiles.get(sheet.authoredByStaffId) ?? null
      : null;
    const qualRisk = getAuthorQualificationRisk(sheet, staffProfile, today);
    if (qualRisk) findings.push(qualRisk);

    // 3. 見直し期限
    const reviewRisk = getReviewOverdueRisk(sheet, today);
    if (reviewRisk) findings.push(reviewRisk);

    // 4. 記録空白
    const recordRisk = getProcedureRecordGapRisk(sheet, safeRecords, today, recordGapThresholdDays);
    if (recordRisk) findings.push(recordRisk);

    // 5. 交付未完了
    const deliveryRisk = getDeliveryMissingRisk(sheet, today);
    if (deliveryRisk) findings.push(deliveryRisk);

    // 6. 加算候補
    const addOnFinding = getAddOnCandidateFindings(sheet, staffProfile, today);
    if (addOnFinding) findings.push(addOnFinding);
  }

  // 7. モニタリング判定
  const monitoringFindings = getMonitoringFindings(userProfile, safeMeetings, today);
  findings.push(...monitoringFindings);

  return findings;
}

// ─────────────────────────────────────────────
// 集計ヘルパー
// ─────────────────────────────────────────────

export interface AuditSummary {
  total: number;
  high: number;
  medium: number;
  low: number;
  byType: Record<AuditFindingType, number>;
}

export function summarizeFindings(findings: AuditFinding[]): AuditSummary {
  const byType = Object.fromEntries(
    AUDIT_FINDING_TYPES.map(t => [t, 0]),
  ) as Record<AuditFindingType, number>;

  let high = 0;
  let medium = 0;
  let low = 0;

  for (const f of findings) {
    byType[f.type] += 1;
    if (f.severity === 'high') high += 1;
    else if (f.severity === 'medium') medium += 1;
    else low += 1;
  }

  return { total: findings.length, high, medium, low, byType };
}
