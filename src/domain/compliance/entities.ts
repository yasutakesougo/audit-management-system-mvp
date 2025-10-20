/**
 * Baseline domain definitions for compliance-critical entities.
 * These types reflect obligations from the 障害者総合支援法 and related運営基準,
 * and underpin the “golden thread” betweenアセスメント → 計画 → 記録 → 請求.
 */

export type ServiceCategory =
  | '生活介護'
  | '就労継続支援A型'
  | '就労継続支援B型'
  | '放課後等デイサービス'
  | '短期入所'
  | 'その他';

export interface BusinessEntity {
  id: string;
  legalName: string;
  officeName: string;
  serviceCategories: ServiceCategory[];
  capacity: number;
  address: string;
  city: string;
  prefecture: string;
  phoneNumber?: string;
  email?: string;
}

export interface ConsentRecord {
  consentType: '情報共有' | '医療連携' | '第三者提供' | 'その他';
  grantedOn: string;
  expiresOn?: string;
  evidenceUri?: string;
}

export interface ServiceContract {
  contractId: string;
  userId: string;
  serviceCategory: ServiceCategory;
  issuedOn: string;
  validFrom: string;
  validTo: string;
  status: '有効' | '更新待ち' | '失効';
  consentRecords: ConsentRecord[];
}

export interface AssessmentRecord {
  assessmentId: string;
  conductedOn: string;
  assessorName: string;
  location: '事業所' | '居宅' | 'その他';
  summary: string;
}

export interface SupportPlanGoal {
  goalId: string;
  title: string;
  description: string;
  category: '長期' | '短期';
  targetDate?: string;
  progressStatus: '未開始' | '進行中' | '達成' | '保留';
}

export interface SupportPlanServiceItem {
  itemId: string;
  title: string;
  frequency: string;
  responsibleStaffRole: string;
  linkedActivityKey?: string;
}

export interface MonitoringLogEntry {
  monitoringId: string;
  monitoredOn: string;
  supervisorName: string;
  outcome: '継続' | '改善提案' | '目標見直し' | '中止提案';
  notes?: string;
}

export interface SupportPlanDocument {
  planId: string;
  userId: string;
  version: number;
  assessmentRecord: AssessmentRecord;
  createdByStaffId: string;
  draftCreatedOn: string;
  approvedOn?: string;
  consentedOn?: string;
  effectiveFrom: string;
  effectiveTo: string;
  goals: SupportPlanGoal[];
  serviceItems: SupportPlanServiceItem[];
  monitoringLogs: MonitoringLogEntry[];
}

export type StaffRole =
  | '管理者'
  | 'サービス管理責任者'
  | '生活支援員'
  | '職業指導員'
  | '看護師'
  | '機能訓練指導員'
  | 'その他';

export interface StaffQualification {
  qualificationId: string;
  name: string;
  issuedOn: string;
  expiresOn?: string;
  certificateUri?: string;
}

export interface StaffMemberComplianceProfile {
  staffId: string;
  name: string;
  role: StaffRole;
  employmentType: '常勤' | '非常勤' | '専従' | '兼務';
  qualifications: StaffQualification[];
  lastAbusePreventionTrainingOn?: string;
  lastBcpTrainingOn?: string;
  lastPhysicalRestraintTrainingOn?: string;
}

export interface ScheduledTrainingSession {
  sessionId: string;
  theme:
    | '虐待防止'
    | '身体拘束適正化'
    | '感染症対策'
    | '業務継続計画'
    | 'その他';
  scheduledOn: string;
  participants: string[]; // staffIds
  materialsUri?: string;
}

export interface ComplianceRiskFlag {
  flagId: string;
  category:
    | '減算リスク'
    | '契約期限切れ'
    | '定員超過'
    | '研修未実施'
    | 'モニタリング期限超過'
    | '支援計画失効'
    | '秘密保持'
    | 'その他';
  severity: 'info' | 'warning' | 'error';
  message: string;
  detectedOn: string;
  resolvedOn?: string;
  relatedUserIds?: string[];
  relatedStaffIds?: string[];
  relatedPlanIds?: string[];
}

export interface ComplianceDashboardSnapshot {
  businessEntityId: string;
  generatedOn: string;
  totalServiceUsers: number;
  activeContracts: number;
  contractsExpiringWithin30Days: number;
  overdueMonitoringCount: number;
  pendingTrainingCount: number;
  riskFlags: ComplianceRiskFlag[];
}
