export type SpUserItem = {
  Id: number;
  Title?: string;
  UserID?: string;
  FullName?: string;
  Furigana?: string;
  FullNameKana?: string;
  AttendanceDays?: string[] | string | null;
  severeFlag?: boolean;
  SevereFlag?: boolean;
  IsHighIntensitySupportTarget?: boolean;
  IsActive?: boolean;
  TransportToDays?: string[] | string | null;
  TransportFromDays?: string[] | string | null;
  Transport_x0020_ToDays?: string[] | string | null;
  Transport_x0020_FromDays?: string[] | string | null;
  RecipientCertNumber?: string;
  RecipientCertExpiry?: string;
  ContractDate?: string | null;
  ServiceStartDate?: string | null;
  ServiceEndDate?: string | null;
  Modified?: string;
  Created?: string;
};

export type User = {
  id: number;
  userId: string;
  name: string;
  furigana?: string;
  nameKana?: string;
  severe?: boolean;
  active?: boolean;
  toDays: string[];
  fromDays: string[];
  attendanceDays: string[];
  certNumber?: string;
  certExpiry?: string;
  serviceStartDate?: string | null;
  serviceEndDate?: string | null;
  contractDate?: string | null;
  highIntensitySupport?: boolean;
  modified?: string;
  created?: string;
};

export type SpStaffItem = {
  Id: number;
  Title?: string;

  StaffID?: string;
  FullName?: string;
  Furigana?: string;
  FullNameKana?: string;
  JobTitle?: string;
  EmploymentType?: string;
  RBACRole?: string;

  Email?: string;
  Phone?: string;
  Role?: string;
  Department?: string;

  IsActive?: boolean;
  HireDate?: string;
  ResignDate?: string;

  Certifications?: string[] | string | null;
  WorkDays?: string[] | string | null;
  Work_x0020_Days?: string[] | string | null;
  BaseShiftStartTime?: string | null;
  BaseShiftEndTime?: string | null;
  BaseWorkingDays?: string[] | string | null;

  Modified?: string;
  Created?: string;
};

export type Staff = {
  id: number;
  staffId: string;
  name: string;
  furigana?: string;
  nameKana?: string;
  jobTitle?: string;
  employmentType?: string;
  rbacRole?: string;

  email?: string;
  phone?: string;
  role?: string;
  department?: string;

  active?: boolean;
  hireDate?: string;
  resignDate?: string;

  certifications: string[];
  workDays: string[];
  baseShiftStartTime?: string;
  baseShiftEndTime?: string;
  baseWorkingDays: string[];
  modified?: string;
  created?: string;
};

export type SpScheduleItem = {
  Id: number;
  Title?: string | null;
  StartDateTime?: string | null;
  EndDateTime?: string | null;
  Status?: string | null;
  ServiceType?: string | null;
  BillingFlags?: string[] | string | null;
  Note?: string | null;
  AssignedStaffId?: number[] | string | { results?: number[] | string[] } | null;
  AssignedStaff?: unknown;
  TargetUserId?: number[] | string | { results?: number[] | string[] } | null;
  TargetUser?: unknown;
  RelatedResourceId?: number[] | string | { results?: number[] | string[] } | null;
  RelatedResource?: unknown;
  RowKey?: string | null;
  Date?: string | null;
  MonthKey?: string | null;
  CreatedAt?: string | null;
  UpdatedAt?: string | null;
  Created?: string;
  Modified?: string;
  '@odata.etag'?: string | null;
  // Legacy fields retained for compatibility during migration
  EventDate?: string | null;
  EndDate?: string | null;
  AllDay?: boolean | null;
  Location?: string | null;
  StaffIdId?: number | string | null;
  UserIdId?: number | string | null;
  Notes?: string | null;
  RecurrenceJson?: string | null;
  RRule?: string | null;
  RecurrenceData?: string | null;
  SubType?: string | null;
  ExternalOrgName?: string | null;
  cr014_orgAudience?: string[] | string | null;
  cr014_resourceId?: string | null;
  DayPart?: string | null;
  StaffLookupId?: number[] | string | { results?: number[] | string[] } | null;
  StaffLookup?: unknown;
  cr014_category?: string | null;
  cr014_serviceType?: string | null;
  cr014_personType?: string | null;
  cr014_personId?: string | null;
  cr014_personName?: string | null;
  cr014_externalPersonName?: string | null;
  cr014_externalPersonOrg?: string | null;
  cr014_externalPersonContact?: string | null;
  cr014_staffIds?: string[] | string | null;
  cr014_staffNames?: string[] | string | null;
  cr014_dayKey?: string | null;
  cr014_fiscalYear?: string | null;
};

export type ScheduleRecurrence = {
  rule: string;
  timezone?: string;
  instanceStart?: string;
  instanceEnd?: string;
};

export type SpDailyItem = {
  Id?: number;
  Title?: string;
  Date?: string;
  StartTime?: string;
  EndTime?: string;
  Location?: string;
  StaffIdId?: number | string | null;
  UserIdId?: number | string | null;
  Notes?: string;
  MealLog?: string;
  BehaviorLog?: string;
  Draft?: unknown;
  Status?: string;
  Created?: string;
  Modified?: string;
  [key: string]: unknown;
};

export type { StaffUpsert } from "./staff";
export { toStaffItem } from "./staff";
export type { UserUpsert } from "./user";
export { toUserItem } from "./user";
export type { DailyStatus, DailyUpsert } from "./daily";
export { DAILY_STATUS_OPTIONS, toDailyItem } from "./daily";
