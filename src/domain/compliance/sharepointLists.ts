/**
 * SharePoint リストの型定義（障害福祉サービス事業所向け）
 *
 * 目的:
 *  - 障害者総合支援法に基づく監査証跡を保持するための必須リスト構造を型安全に定義する。
 *  - 将来の SharePoint API 連携層（spClient 等）で再利用できるよう、内部名・型を明文化する。
 */

export type SpLookupValue<T = number> =
  | T
  | null
  | undefined
  | { results?: T[] | null }
  | (T | { results?: T[] | null })[];

/**
 * Users_Master – 利用者マスタ
 * エンティティ: 利用者
 */
export interface SpUserMasterItem {
  Id: number;
  Title: string; // 氏名
  UserCode: string; // 利用者コード（一意）
  Furigana?: string;
  BirthDate?: string;
  Gender?: '男性' | '女性' | 'その他' | '';
  DisabilityCertificationLevel?: string;
  ContactPhone?: string;
  ContactEmail?: string;
  FamilyContactName?: string;
  FamilyContactPhone?: string;
  IsActive: boolean;
  Notes?: string;
  ConsentInfo?: string;
  Created?: string;
  Modified?: string;
}

/**
 * Contracts – 契約・受給者証情報
 * エンティティ: 利用契約
 */
export interface SpServiceContractItem {
  Id: number;
  Title?: string | null;
  UserCode: string;
  ServiceCategory: string;
  ContractId?: string | null;
  IssuedOn?: string | null;
  ValidFrom: string;
  ValidTo: string;
  Status?: '有効' | '更新待ち' | '失効' | '';
  ConsentRecordsJson?: string | null;
  Notes?: string;
  Attachments?: boolean;
  Created?: string;
  Modified?: string;
}

/**
 * Plans – 個別支援計画
 * エンティティ: 支援計画ドキュメント
 */
export interface SpSupportPlanItem {
  Id: number;
  Title: string;
  UserCode: string;
  PlanId: string;
  Version: number;
  AssessmentJson: string;
  GoalsJson: string;
  ServiceItemsJson: string;
  MonitoringLogsJson?: string;
  PlanStatus?: '原案' | '同意済み' | '交付済み' | '失効' | '';
  DraftCreatedOn: string;
  ApprovedOn?: string;
  ConsentedOn?: string;
  EffectiveFrom: string;
  EffectiveTo: string;
  CreatedByStaffId?: SpLookupValue<number>;
  Attachments?: boolean;
  Created?: string;
  Modified?: string;
}

/**
 * Attendance_Visits – 通所実績
 * エンティティ: 1人1日レコード
 */
export interface SpAttendanceVisitItem {
  Id: number;
  Title?: string | null;
  UserCode: string;
  RecordDate: string; // Date only
  Status: '未' | '通所中' | '退所済' | '当日欠席';
  CheckInAt?: string | null;
  CheckOutAt?: string | null;
  CntAttendIn: number;
  CntAttendOut: number;
  TransportTo?: boolean;
  TransportFrom?: boolean;
  IsEarlyLeave?: boolean;
  AbsentMorningContacted?: boolean;
  AbsentMorningMethod?: '電話' | 'SMS' | '家族' | 'その他' | '';
  EveningChecked?: boolean;
  EveningNote?: string | null;
  IsAbsenceAddonClaimable?: boolean;
  Note?: string | null;
  BusinessKey: string; // UserCode-yyyymmdd
  Attachments?: boolean;
  Created?: string;
  Modified?: string;
}

/**
 * IncidentReports – 事故・ヒヤリハット
 */
export interface SpIncidentReportItem {
  Id: number;
  Title: string;
  UserCode?: string;
  OccurredOn: string;
  OccurredAt?: string;
  IncidentType: '事故' | 'ヒヤリハット';
  Severity?: '軽微' | '中等度' | '重大';
  Location?: string;
  Description: string;
  ImmediateAction?: string;
  PreventiveAction?: string;
  ReportedToMunicipality?: boolean;
  MunicipalityReportDate?: string;
  Attachments?: boolean;
  Created?: string;
  Modified?: string;
}

/**
 * Trainings – 法定研修セッション
 */
export interface SpTrainingSessionItem {
  Id: number;
  Title: string;
  Theme:
    | '虐待防止'
    | '身体拘束適正化'
    | '感染症対策'
    | '業務継続計画'
    | 'その他';
  ScheduledOn: string;
  HeldOn?: string;
  Instructor?: string;
  ParticipantStaffIds?: SpLookupValue<number>;
  MaterialsUri?: string;
  Notes?: string;
  Attachments?: boolean;
  Created?: string;
  Modified?: string;
}

/**
 * Staff_Master – 従業者マスタ
 */
export interface SpStaffMasterItem {
  Id: number;
  Title: string; // 氏名
  StaffId: string;
  Role?: string;
  EmploymentType?: '常勤' | '非常勤' | '専従' | '兼務' | '';
  Email?: string;
  Phone?: string;
  HireDate?: string;
  ResignDate?: string;
  CertificationsJson?: string;
  LastAbusePreventionTrainingOn?: string;
  LastBcpTrainingOn?: string;
  LastPhysicalRestraintTrainingOn?: string;
  Notes?: string;
  IsActive?: boolean;
  Created?: string;
  Modified?: string;
}

/**
 * Utility: リスト内部名の定数
 */
export const SharePointListNames = {
  users: 'Users_Master',
  contracts: 'Service_Contracts',
  supportPlans: 'Support_Plans',
  attendance: 'Attendance_Visits',
  incidents: 'IncidentReports',
  trainings: 'Trainings',
  staff: 'Staff_Master',
} as const;

export type SharePointListName = (typeof SharePointListNames)[keyof typeof SharePointListNames];
