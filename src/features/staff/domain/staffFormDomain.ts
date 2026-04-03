/**
 * StaffForm — Constants, types, validation, and mapper functions.
 * Extracted from StaffForm.tsx for testability.
 */
import type { Staff } from '@/types';

// ─── Types ─────────────────────────────────────────────────────

export type StaffFormProps = {
  staff?: Staff;
  mode?: 'create' | 'update';
  onSuccess?: (staff: Staff) => void;
  onDone?: (staff: Staff) => void;
  onClose?: () => void;
};

export type MessageState = { type: 'success' | 'error'; text: string } | null;

export type FormValues = {
  StaffID: string;
  FullName: string;
  Email: string;
  Phone: string;
  Role: string;
  WorkDays: string[];
  Certifications: string[];
  IsActive: boolean;
  BaseShiftStartTime: string;
  BaseShiftEndTime: string;
  BaseWorkingDays: string[];
};

export type Errors = Partial<Record<'fullName' | 'email' | 'phone' | 'baseShift', string>>;

// ─── Constants ─────────────────────────────────────────────────

export const DAYS: { value: string; label: string }[] = [
  { value: 'Mon', label: '月' },
  { value: 'Tue', label: '火' },
  { value: 'Wed', label: '水' },
  { value: 'Thu', label: '木' },
  { value: 'Fri', label: '金' },
  { value: 'Sat', label: '土' },
  { value: 'Sun', label: '日' },
];

export const BASE_WEEKDAY_OPTIONS: { value: string; label: string }[] = [
  { value: '月', label: '月' },
  { value: '火', label: '火' },
  { value: '水', label: '水' },
  { value: '木', label: '木' },
  { value: '金', label: '金' },
];

export const BASE_WEEKDAY_DEFAULTS = BASE_WEEKDAY_OPTIONS.map((option) => option.value);

export const CERTIFICATION_OPTIONS: { value: string; label: string }[] = [
  { value: '普通運転免許', label: '普通運転免許' },
  { value: '介護福祉士', label: '介護福祉士' },
  { value: '看護師', label: '看護師' },
  { value: '保育士', label: '保育士' },
  { value: '社会福祉士', label: '社会福祉士' },
];

// ─── Validation ────────────────────────────────────────────────

export const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const timeRe = /^\d{2}:\d{2}$/;

export const sanitize = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

export function validateStaffForm(values: FormValues): Errors {
  const errs: Errors = {};
  if (!values.FullName.trim() && !values.StaffID.trim()) {
    errs.fullName = '氏名（またはスタッフID）のいずれかは必須です';
  }
  if (values.Email && !emailRe.test(values.Email.trim())) {
    errs.email = 'メール形式が不正です';
  }
  if (values.Phone) {
    const digits = values.Phone.replace(/\D/g, '');
    if (digits.length < 10) {
      errs.phone = '電話番号を正しく入力してください';
    }
  }
  const start = values.BaseShiftStartTime.trim();
  const end = values.BaseShiftEndTime.trim();
  const hasStart = start.length > 0;
  const hasEnd = end.length > 0;
  if ((hasStart && !timeRe.test(start)) || (hasEnd && !timeRe.test(end))) {
    errs.baseShift = '時刻はHH:MM形式で入力してください';
  } else if (hasStart && hasEnd && end <= start) {
    errs.baseShift = '基本勤務の終了時刻は開始時刻より後にしてください';
  }
  return errs;
}

// ─── Mapper ────────────────────────────────────────────────────

export function toStaffStorePayload(values: FormValues): Partial<Staff> {
  const baseStart = values.BaseShiftStartTime.trim();
  const baseEnd = values.BaseShiftEndTime.trim();
  const workingDays = values.BaseWorkingDays.filter(Boolean);

  return {
    staffId: sanitize(values.StaffID),
    name: sanitize(values.FullName),
    email: sanitize(values.Email),
    phone: sanitize(values.Phone),
    role: sanitize(values.Role),
    workDays: [...values.WorkDays],
    certifications: [...values.Certifications],
    active: values.IsActive,
    baseShiftStartTime: baseStart ? baseStart : undefined,
    baseShiftEndTime: baseEnd ? baseEnd : undefined,
    baseWorkingDays: [...workingDays],
  };
}
