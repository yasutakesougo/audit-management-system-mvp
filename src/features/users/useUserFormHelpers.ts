/**
 * useUserFormHelpers
 *
 * useUserForm フックで使用する純粋なヘルパー関数をまとめたファイル。
 * React ステートやフック API への依存なし。
 */
import type { IUserMasterCreateDto } from '../../sharepoint/fields';
import { parseTransportCourse } from '../today/transport/transportCourse';
import { WEEKDAYS } from './useUserFormConstants';
import type { DayTransport, FormValues } from './useUserFormTypes';

// ---------------------------------------------------------------------------
// Transport Schedule helpers
// ---------------------------------------------------------------------------

const EMPTY_SCHEDULE: Record<string, DayTransport> = {};

export function parseTransportSchedule(json: string | null | undefined): Record<string, DayTransport> {
  if (!json) return { ...EMPTY_SCHEDULE };
  try {
    const parsed = JSON.parse(json) as Record<string, DayTransport>;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return { ...EMPTY_SCHEDULE };
    return parsed;
  } catch {
    return { ...EMPTY_SCHEDULE };
  }
}

export function serializeTransportSchedule(schedule: Record<string, DayTransport>): string | null {
  // Runtime guard: reject non-plain-object values that may arrive via type casts at JS runtime.
  // mirrors the Array.isArray guard in parseTransportSchedule (Night Run 6).
  if (typeof schedule !== 'object' || schedule === null || Array.isArray(schedule)) return null;
  // Remove empty entries
  const cleaned: Record<string, DayTransport> = {};
  for (const [day, val] of Object.entries(schedule)) {
    if (val.to || val.from) {
      cleaned[day] = val;
    }
  }
  return Object.keys(cleaned).length ? JSON.stringify(cleaned) : null;
}

export function deriveTransportDays(
  schedule: Record<string, DayTransport>,
): { attendanceDays: string[]; transportToDays: string[]; transportFromDays: string[] } {
  const weekdayOrder = WEEKDAYS.map((d) => d.value);
  const attendanceDays: string[] = [];
  const transportToDays: string[] = [];
  const transportFromDays: string[] = [];

  for (const day of weekdayOrder) {
    const entry = schedule[day];
    if (!entry) continue;
    if (entry.to || entry.from) {
      attendanceDays.push(day);
    }
    if (entry.to === 'office_shuttle') {
      transportToDays.push(day);
    }
    if (entry.from === 'office_shuttle') {
      transportFromDays.push(day);
    }
  }

  return { attendanceDays, transportToDays, transportFromDays };
}

// ---------------------------------------------------------------------------
// Sanitization / DTO builder
// ---------------------------------------------------------------------------

const sanitize = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
};

export const toCreateDto = (values: FormValues): IUserMasterCreateDto => ({
  FullName: values.FullName.trim(),
  Furigana: sanitize(values.Furigana) || null,
  FullNameKana: sanitize(values.FullNameKana) || null,
  ContractDate: sanitize(values.ContractDate) || null,
  ServiceStartDate: sanitize(values.ServiceStartDate) || null,
  ServiceEndDate: sanitize(values.ServiceEndDate) || null,
  IsHighIntensitySupportTarget: values.IsHighIntensitySupportTarget,
  IsSupportProcedureTarget: values.IsSupportProcedureTarget,
  severeFlag: false,
  IsActive: values.IsActive,
  TransportCourse: parseTransportCourse(values.TransportCourse) ?? null,
  ...(() => {
    const derived = deriveTransportDays(values.TransportSchedule);
    return {
      TransportToDays: derived.transportToDays.length ? derived.transportToDays : null,
      TransportFromDays: derived.transportFromDays.length ? derived.transportFromDays : null,
      AttendanceDays: derived.attendanceDays.length ? derived.attendanceDays : null,
    };
  })(),
  TransportSchedule: serializeTransportSchedule(values.TransportSchedule),
  RecipientCertNumber: sanitize(values.RecipientCertNumber) || null,
  RecipientCertExpiry: sanitize(values.RecipientCertExpiry) || null,
  UsageStatus: sanitize(values.UsageStatus) || null,
  GrantMunicipality: sanitize(values.GrantMunicipality) || null,
  GrantPeriodStart: sanitize(values.GrantPeriodStart) || null,
  GrantPeriodEnd: sanitize(values.GrantPeriodEnd) || null,
  DisabilitySupportLevel: sanitize(values.DisabilitySupportLevel) || null,
  GrantedDaysPerMonth: sanitize(values.GrantedDaysPerMonth) || null,
  UserCopayLimit: sanitize(values.UserCopayLimit) || null,
  TransportAdditionType: sanitize(values.TransportAdditionType) || null,
  MealAddition: sanitize(values.MealAddition) || null,
  CopayPaymentMethod: sanitize(values.CopayPaymentMethod) || null,
});
