/**
 * auditCheckInputBuilder — 実データ → AuditCheckInput 変換
 *
 * SP のマスタ系データを `buildRegulatoryFindings` が要求する
 * `AuditCheckInput` に組み立てる純粋関数群。
 *
 * UI / Repository には一切依存せず、テストしやすい変換層。
 *
 * @see auditChecks.ts — AuditCheckInput, SheetAuditInfo, RecordAuditInfo
 * @see userRegulatoryProfile.ts — UserRegulatoryProfile
 * @see staffQualificationProfile.ts — StaffQualificationProfile
 */

import type { UserRegulatoryProfile } from './userRegulatoryProfile';
import type { StaffQualificationProfile } from './staffQualificationProfile';
import type {
  AuditCheckInput,
  SheetAuditInfo,
  RecordAuditInfo,
  MonitoringAuditInfo,
} from './auditChecks';
import type { IUserMaster } from '@/sharepoint/fields';
import type { Staff } from '@/types';
import type { PlanningSheetListItem } from '@/domain/isp/schema';
import type { MonitoringMeetingRecord } from '@/domain/isp/monitoringMeeting';

// ─────────────────────────────────────────────
// IUserMaster → UserRegulatoryProfile
// ─────────────────────────────────────────────

function parseServiceTypes(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function toUserRegulatoryProfile(user: IUserMaster): UserRegulatoryProfile {
  return {
    userId: user.UserID ?? `user-${user.Id}`,
    behaviorScore: user.BehaviorScore ?? null,
    childBehaviorScore: user.ChildBehaviorScore ?? null,
    disabilitySupportLevel: user.DisabilitySupportLevel ?? null,
    serviceTypes: parseServiceTypes(user.ServiceTypesJson) as UserRegulatoryProfile['serviceTypes'],
    severeBehaviorSupportEligible: user.IsHighIntensitySupportTarget ?? false,
    eligibilityCheckedAt: user.EligibilityCheckedAt ?? null,
  };
}

// ─────────────────────────────────────────────
// Staff → StaffQualificationProfile
// ─────────────────────────────────────────────

export function toStaffQualificationProfile(staff: Staff): StaffQualificationProfile {
  const certs = staff.certifications ?? [];

  return {
    staffId: staff.staffId ?? String(staff.id),
    hasPracticalTraining: certs.some((c: string) => c.includes('実践研修')),
    hasBasicTraining: certs.some((c: string) => c.includes('基礎研修')),
    hasBehaviorGuidanceTraining: certs.some((c: string) => c.includes('行動援護')),
    hasCorePersonTraining: certs.some((c: string) => c.includes('中核的人材')),
    certificationCheckedAt: null,
  };
}

export function buildStaffProfilesMap(staffList: Staff[]): Map<string, StaffQualificationProfile> {
  const map = new Map<string, StaffQualificationProfile>();
  for (const s of staffList) {
    if (s.active === false) continue;
    const profile = toStaffQualificationProfile(s);
    map.set(profile.staffId, profile);
  }
  return map;
}

// ─────────────────────────────────────────────
// PlanningSheetListItem → SheetAuditInfo
// ─────────────────────────────────────────────

export function toSheetAuditInfo(sheet: PlanningSheetListItem): SheetAuditInfo {
  return {
    id: sheet.id,
    userId: sheet.userId,
    title: sheet.title,
    authoredByStaffId: undefined,                  // PlanningSheetListItem has authoredByQualification but not staffId
    authoredByQualification: sheet.authoredByQualification,
    applicableAddOnTypes: sheet.applicableAddOnTypes,
    nextReviewAt: sheet.nextReviewAt,
    deliveredToUserAt: null,                       // 一覧では deliveredToUserAt を持たない → null で欠損扱い
    status: sheet.status,
    isCurrent: sheet.isCurrent,
  };
}

// ─────────────────────────────────────────────
// ProcedureRecordListItem → RecordAuditInfo
// ─────────────────────────────────────────────

export interface RecordMinimal {
  id: string;
  planningSheetId: string;
  recordDate: string;
}

export function toRecordAuditInfo(record: RecordMinimal): RecordAuditInfo {
  return {
    id: record.id,
    planningSheetId: record.planningSheetId,
    recordDate: record.recordDate,
  };
}

// ─────────────────────────────────────────────
// MonitoringMeetingRecord → MonitoringAuditInfo
// ─────────────────────────────────────────────

export function toMonitoringAuditInfo(meeting: MonitoringMeetingRecord): MonitoringAuditInfo {
  return {
    id: meeting.id,
    userId: meeting.userId,
    meetingDate: meeting.meetingDate,
    status: meeting.status as 'draft' | 'finalized',
    qualificationStatus: meeting.qualificationCheckStatus || 'warning',
    hasBasicTrainedMember: meeting.hasBasicTrainedMember || false,
    hasPracticalTrainedMember: meeting.hasPracticalTrainedMember || false,
  };
}

// ─────────────────────────────────────────────
// 統合ビルダー（利用者単位）
// ─────────────────────────────────────────────

export interface RealDataInputs {
  users: IUserMaster[];
  staff: Staff[];
  sheetsByUser: Map<string, PlanningSheetListItem[]>;
  recordsBySheet: Map<string, RecordMinimal[]>;
  monitoringMeetingsByUser: Map<string, MonitoringMeetingRecord[]>;
}

/**
 * 全利用者の AuditCheckInput を生成する
 *
 * `buildRegulatoryFindings` は利用者単位なので、
 * 利用者ごとにループして input を作る。
 */
export function buildAllAuditCheckInputs(
  data: RealDataInputs,
  today: string,
): AuditCheckInput[] {
  const staffProfiles = buildStaffProfilesMap(data.staff);
  const inputs: AuditCheckInput[] = [];

  for (const user of data.users) {
    if (user.IsActive === false) continue;

    const userId = user.UserID ?? `user-${user.Id}`;
    const userProfile = toUserRegulatoryProfile(user);

    // この利用者の PlanningSheet を取得
    const sheets = (data.sheetsByUser.get(userId) ?? []).map(toSheetAuditInfo);

    // この利用者のシートに紐づく記録を集める
    const records: RecordAuditInfo[] = [];
    for (const sheet of sheets) {
      const sheetRecords = data.recordsBySheet.get(sheet.id) ?? [];
      for (const r of sheetRecords) {
        records.push(toRecordAuditInfo(r));
      }
    }

    // この利用者のモニタリングを集める
    const monitoringMeetings = (data.monitoringMeetingsByUser.get(userId) ?? []).map(toMonitoringAuditInfo);

    inputs.push({
      userProfile,
      sheets,
      staffProfiles,
      records,
      monitoringMeetings,
      today,
    });
  }

  return inputs;
}
