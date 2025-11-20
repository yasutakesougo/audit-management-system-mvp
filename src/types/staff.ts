import { FIELD_MAP } from "@/sharepoint/fields";

const map = FIELD_MAP.Staff_Master;

const sanitizeString = (value: string | undefined | null) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeStringArray = (input: readonly (string | null | undefined)[] | undefined | null) => {
  if (!input) return [] as string[];
  const normalized = input
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value): value is string => value.length > 0);
  return Array.from(new Set(normalized));
};

/**
 * 時刻文字列をISO形式に正規化
 * TimeOnly列用: 不正値や未入力の場合は明示的にnullを送って値をクリアする
 */
const normalizeTimeToIso = (value: string | null | undefined): string | null => {
  if (value === null) return null;
  if (value === undefined) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number.parseInt(match[1]!, 10);
  const minutes = Number.parseInt(match[2]!, 10);
  if (Number.isNaN(hours) || Number.isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  const iso = new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
  return iso.toISOString();
};

export type StaffUpsert = {
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
  HireDate?: string | null;
  ResignDate?: string | null;
  Certifications?: string[];
  WorkDays?: string[];
  BaseShiftStartTime?: string | null;
  BaseShiftEndTime?: string | null;
  BaseWorkingDays?: string[];
};

export const toStaffItem = (input: StaffUpsert): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};

  const staffId = sanitizeString(input.StaffID);
  if (staffId !== undefined) payload[map.staffId] = staffId;

  const fullName = sanitizeString(input.FullName);
  if (fullName) payload[map.fullName] = fullName;

  const furigana = sanitizeString(input.Furigana);
  if (furigana !== undefined) payload[map.furigana] = furigana;

  const fullNameKana = sanitizeString(input.FullNameKana);
  if (fullNameKana !== undefined) payload[map.fullNameKana] = fullNameKana;

  const jobTitle = sanitizeString(input.JobTitle);
  if (jobTitle !== undefined) payload[map.jobTitle] = jobTitle;

  const employmentType = sanitizeString(input.EmploymentType);
  if (employmentType !== undefined) payload[map.employmentType] = employmentType;

  const rbacRole = sanitizeString(input.RBACRole);
  if (rbacRole !== undefined) payload[map.rbacRole] = rbacRole;

  const email = sanitizeString(input.Email);
  if (email !== undefined) payload[map.email] = email;

  const phone = sanitizeString(input.Phone);
  if (phone !== undefined) payload[map.phone] = phone;

  const role = sanitizeString(input.Role);
  if (role !== undefined) payload[map.role] = role;

  const department = sanitizeString(input.Department);
  if (department !== undefined) payload[map.department] = department;

  if (input.IsActive !== undefined) payload[map.isActive] = Boolean(input.IsActive);

  if (input.HireDate !== undefined) payload[map.hireDate] = input.HireDate ?? null;
  if (input.ResignDate !== undefined) payload[map.resignDate] = input.ResignDate ?? null;

  if (input.Certifications !== undefined) {
    payload[map.certifications] = normalizeStringArray(input.Certifications);
  }

  if (input.WorkDays !== undefined) {
    payload[map.workDays] = normalizeStringArray(input.WorkDays);
  }

  if (input.BaseShiftStartTime !== undefined) {
    payload[map.baseShiftStartTime] = normalizeTimeToIso(input.BaseShiftStartTime);
  }

  if (input.BaseShiftEndTime !== undefined) {
    payload[map.baseShiftEndTime] = normalizeTimeToIso(input.BaseShiftEndTime);
  }

  if (input.BaseWorkingDays !== undefined) {
    payload[map.baseWorkingDays] = normalizeStringArray(input.BaseWorkingDays);
  }

  const title = fullName ?? staffId;
  if (title) payload[map.title] = title;

  return payload;
};
