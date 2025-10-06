import type { SPItem } from '@/lib/sp.types';
import { z } from 'zod';

// Domain enums kept small & literal to avoid over-typing Graph/SP values.
export type Category = 'Org' | 'User' | 'Staff';

export const SCHEDULE_STATUSES = ['下書き', '申請中', '承認済み', '完了'] as const;
export type Status = (typeof SCHEDULE_STATUSES)[number];

// Care services in scope for "User"
export type ServiceType = '一時ケア' | 'ショートステイ';

// Internal master vs. ad-hoc external person (no master record)
export type PersonType = 'Internal' | 'External';

export type DayPart = 'Full' | 'AM' | 'PM';

export type BaseShiftWarningReason = 'day' | 'time' | 'span';

export interface BaseShiftWarning {
  staffId: string;
  staffName?: string;
  reasons: BaseShiftWarningReason[];
}

/** Common schedule fields (shared across categories) */
export interface BaseSchedule {
  id: string;
  etag: string;
  category: Category;
  title: string;
  start: string;   // ISO 8601
  end: string;     // ISO 8601
  allDay: boolean;
  status: Status;
  location?: string;
  notes?: string;
  recurrenceRule?: string; // RFC5545 (optional; may be empty for MVP)
  // Common computed/aux
  dayKey?: string;         // yyyymmdd (UI/grouping helper)
  fiscalYear?: string;     // '2025' etc. (for annual rollups)
  baseShiftWarnings?: BaseShiftWarning[];
}

/** User-care schedule (supports internal or external person) */
export interface ScheduleUserCare extends BaseSchedule {
  category: 'User';
  serviceType: ServiceType;
  // Person identity (branch by personType)
  personType: PersonType;
  // Internal (master-backed)
  personId?: string;
  personName?: string;
  // External (ad-hoc)
  externalPersonName?: string;
  externalPersonOrg?: string;
  externalPersonContact?: string;
  // Assignment (one or multiple staff)
  staffIds: string[];
  staffNames?: string[];
}

/** Org / Staff stubs (unchanged here; keep your existing shapes) */
export interface ScheduleOrg extends BaseSchedule {
  category: 'Org';
  subType: '会議' | '研修' | '監査' | '余暇イベント' | '外部団体利用';
  audience?: string[]; // e.g., 全職員/看護/生活介護
  resourceId?: string; // 例: プレイルーム（将来の部屋レーン用）
  externalOrgName?: string; // さつき会/パレットクラブ 等
}

export interface ScheduleStaff extends BaseSchedule {
  category: 'Staff';
  subType: '会議' | '研修' | '来客対応' | '年休';
  staffIds: string[];      // owner(s)
  staffNames?: string[];
  dayPart?: DayPart;       // 年休時のみ使用
}

/** Narrowed union for everywhere else in the app */
export type Schedule = ScheduleUserCare | ScheduleOrg | ScheduleStaff;

/**
 * ──────────────────────────────────────────────────────────────
 * Week view / CRUD MVP shared types
 * ──────────────────────────────────────────────────────────────
 */
export type ScheduleStatus = 'planned' | 'confirmed' | 'absent' | 'holiday';

export interface ScheduleForm {
  id?: number;
  /** SharePoint lookup id as string for compatibility with existing text lookups */
  userId: string;
  title?: string;
  note?: string;
  status: ScheduleStatus;
  /** ISO 8601 datetime */
  start: string;
  /** ISO 8601 datetime */
  end: string;
}

/** ──────────────────────────────────────────────────────────────
 *  Type guards (for discriminated narrowing)
 *  ──────────────────────────────────────────────────────────── */
export const isUserCare = (s: Schedule): s is ScheduleUserCare => s.category === 'User';
export const isOrg      = (s: Schedule): s is ScheduleOrg      => s.category === 'Org';
export const isStaff    = (s: Schedule): s is ScheduleStaff    => s.category === 'Staff';

/** Resolve the display name for a user-care record (internal vs external) */
export function getUserCareDisplayName(s: ScheduleUserCare): string {
  return s.personType === 'Internal'
    ? (s.personName ?? '')
    : (s.externalPersonName ?? '');
}

/** ──────────────────────────────────────────────────────────────
 *  SharePoint schedule item schema (raw list rows)
 *  ──────────────────────────────────────────────────────────── */
export const ScheduleCategory = z.enum(['User', 'Facility', 'Other']);
export type ScheduleCategory = z.infer<typeof ScheduleCategory>;

export const ScheduleItemSchema = z.object({
  Id: z.number(),
  Title: z.string().optional(),
  cr014_category: ScheduleCategory,
  EventDate: z.string(),
  EndDate: z.string(),
  cr014_usercode: z.string().optional(),
});

export type ScheduleItem = z.infer<typeof ScheduleItemSchema>;
export type SPScheduleItem = SPItem<Omit<ScheduleItem, 'Id' | 'Title'> & { Title?: string }>;

export const parseScheduleArray = (input: unknown): ScheduleItem[] => ScheduleItemSchema.array().parse(input);

/** Daily record demo dataset shape */
export type DailyRecord = {
  Id: number;
  RecordDate: string;
  ActivityAM?: string;
  ActivityPM?: string;
  LunchAmount?: number;
  BehaviorChecks?: string[];
  Notes?: string;
};

export type ComplianceRecord = {
  Id: number;
  Date: string;
  Category: string;
  Severity?: 'Low' | 'Medium' | 'High' | 'Critical';
  Description: string;
  Resolved?: boolean;
  Notes?: string;
};

export type AttendanceRecord = {
  Id: number;
  Date: string;
  CheckIn?: string;
  CheckOut?: string;
  Late?: boolean;
  EarlyLeave?: boolean;
  Absent?: boolean;
  Notes?: string;
};
