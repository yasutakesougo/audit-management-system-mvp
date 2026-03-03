import {
    DAILY_FIELD_BEHAVIOR_LOG,
    DAILY_FIELD_DATE,
    DAILY_FIELD_DRAFT,
    DAILY_FIELD_END_TIME,
    DAILY_FIELD_LOCATION,
    DAILY_FIELD_MEAL_LOG,
    DAILY_FIELD_NOTES,
    DAILY_FIELD_STAFF_ID,
    DAILY_FIELD_START_TIME,
    DAILY_FIELD_STATUS,
    DAILY_FIELD_USER_ID,
    type DailyRow,
    type StaffRow,
    type UserRow,
} from '@/sharepoint/fields';
import type { Staff, User } from '@/types';

export const normalizeStringArray = (input: unknown): string[] => {
	if (!input) {
		return [];
	}

	if (Array.isArray(input)) {
		return Array.from(
			new Set(
				input
					.map((value) => (typeof value === 'string' ? value.trim() : ''))
					.filter((value): value is string => value.length > 0)
			)
		);
	}

	if (typeof input === 'object' && input !== null && Array.isArray((input as { results?: unknown }).results)) {
		return normalizeStringArray((input as { results: unknown[] }).results);
	}

	if (typeof input === 'string') {
		const trimmed = input.trim();
		if (!trimmed) {
			return [];
		}
		const delimiter = trimmed.includes(';#')
			? ';#'
			: trimmed.includes(',')
				? ','
				: null;
		if (!delimiter) {
			return [trimmed];
		}
		return Array.from(
			new Set(
				trimmed
					.split(delimiter)
					.map((part) => part.trim())
					.filter((part): part is string => part.length > 0)
			)
		);
	}

	return [];
};

const toTimeString = (value: unknown): string | undefined => {
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	if (!trimmed) return undefined;
	const directMatch = trimmed.match(/^(\d{1,2}):(\d{2})$/);
	if (directMatch) {
		const hours = Number.parseInt(directMatch[1]!, 10);
		const minutes = Number.parseInt(directMatch[2]!, 10);
		if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
			return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
		}
	}
	const date = new Date(trimmed);
	if (Number.isNaN(date.getTime())) return undefined;
	const hours = date.getUTCHours().toString().padStart(2, '0');
	const minutes = date.getUTCMinutes().toString().padStart(2, '0');
	return `${hours}:${minutes}`;
};

const toDateOnly = (iso?: string): string | undefined => {
	if (!iso) return undefined;
	const candidate = iso.slice(0, 10);
	return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : undefined;
};

export const pickField = <T>(item: Record<string, unknown>, ...keys: string[]): T | undefined => {
	for (const key of keys) {
		const value = item[key];
		if (value !== undefined && value !== null) {
			return value as T;
		}
	}
	return undefined;
};

export function mapUser(item: UserRow): User {
	const record = item as unknown as Record<string, unknown>;
	const contractDateValue = toDateOnly(pickField<string>(record, 'ContractDate'));
	const serviceStartDateValue = toDateOnly(pickField<string>(record, 'ServiceStartDate'));
	const serviceEndDateValue = toDateOnly(pickField<string | null>(record, 'ServiceEndDate') ?? undefined);
	const highIntensitySupport = pickField<boolean>(record, 'IsHighIntensitySupportTarget', 'severeFlag', 'SevereFlag') ?? false;
	const transportToRaw = pickField<unknown>(record, 'TransportToDays', 'Transport_x0020_ToDays');
	const transportFromRaw = pickField<unknown>(record, 'TransportFromDays', 'Transport_x0020_FromDays');
	const attendanceRaw = pickField<unknown>(record, 'AttendanceDays');
	const certNumberRaw = pickField<string | null>(record, 'RecipientCertNumber');
	const certExpiryRaw = pickField<string | null>(record, 'RecipientCertExpiry');
	const isActive = pickField<boolean>(record, 'IsActive');
	const modified = pickField<string>(record, 'Modified');
	const created = pickField<string>(record, 'Created');
	const furigana = pickField<string>(record, 'Furigana');
	const fullNameKana = pickField<string>(record, 'FullNameKana');
	return {
		id: item.Id,
		userId: item.UserID?.trim() ?? '',
		name: item.FullName?.trim() ?? item.Title?.trim() ?? '',
		furigana: furigana?.trim() || undefined,
		nameKana: fullNameKana?.trim() || undefined,
		severe: highIntensitySupport,
		active: isActive ?? true,
		toDays: normalizeStringArray(transportToRaw),
		fromDays: normalizeStringArray(transportFromRaw),
		attendanceDays: normalizeStringArray(attendanceRaw),
		certNumber: certNumberRaw?.trim() || undefined,
		certExpiry: toDateOnly(certExpiryRaw ?? undefined),
		serviceStartDate: serviceStartDateValue ?? null,
		serviceEndDate: serviceEndDateValue ?? null,
		contractDate: contractDateValue ?? null,
		highIntensitySupport,
		modified,
		created,
	};
}

export function mapStaff(item: StaffRow): Staff {
	const certifications = normalizeStringArray(item.Certifications);
	const legacyWorkDays = 'WorkDays' in item ? (item as { WorkDays?: string[] | string | null }).WorkDays : undefined;
	const workDays = normalizeStringArray(item.Work_x0020_Days ?? legacyWorkDays);
	const baseWorkingDays = normalizeStringArray(item.BaseWorkingDays);
	const baseShiftStartTime = toTimeString(item.BaseShiftStartTime ?? undefined);
	const baseShiftEndTime = toTimeString(item.BaseShiftEndTime ?? undefined);
	const jobTitle = item.JobTitle?.trim() || undefined;
	const rbacRole = item.RBACRole?.trim() || undefined;
	const inferredRole = item.Role?.trim() || jobTitle || rbacRole || undefined;
	const employmentType = item.EmploymentType?.trim() || undefined;

	return {
		id: item.Id,
		staffId: item.StaffID?.trim() || String(item.Id),
		name: item.FullName?.trim() ?? item.Title?.trim() ?? '',
		furigana: item.Furigana?.trim() || undefined,
		nameKana: item.FullNameKana?.trim() || undefined,
		jobTitle,
		employmentType,
		rbacRole,

		email: item.Email?.trim() || undefined,
		phone: item.Phone?.trim() || undefined,
		role: inferredRole,
		department: item.Department?.trim() || undefined,

		active: item.IsActive ?? true,
		hireDate: toDateOnly(item.HireDate),
		resignDate: toDateOnly(item.ResignDate),

		certifications,
		workDays,
		baseShiftStartTime: baseShiftStartTime ?? undefined,
		baseShiftEndTime: baseShiftEndTime ?? undefined,
		baseWorkingDays,
		modified: item.Modified,
		created: item.Created,
	};
}

export const toNullableString = (value: unknown): string | null => {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length ? trimmed : null;
};

export const toNullableNumber = (value: unknown): number | null => {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim().length) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
};

export const normalizeNumberArray = (input: unknown): number[] => {
	if (!input) return [];
	const source = Array.isArray(input)
		? input
		: typeof input === 'object' && input !== null && Array.isArray((input as { results?: unknown }).results)
			? (input as { results: unknown[] }).results
			: [input];
	const values = source
		.map((value) => toNullableNumber(value))
		.filter((value): value is number => value !== null);
	return Array.from(new Set(values));
};

export const parseJsonValue = (value: unknown): unknown => {
	if (value == null) return null;
	if (typeof value === 'string') {
		const trimmed = value.trim();
		if (!trimmed) return null;
		try {
			return JSON.parse(trimmed);
		} catch {
			return trimmed;
		}
	}
	return value;
};

export type Daily = {
	id: number;
	title: string | null;
	date: string | null;
	startTime: string | null;
	endTime: string | null;
	location: string | null;
	staffId: number | null;
	notes: string | null;
	mealLog: string | null;
	behaviorLog: string | null;
	draft: unknown;
	status: string | null;
	userId?: number | null;
	modified?: string;
	created?: string;
};

export function mapDaily(item: DailyRow): Daily {
	return {
		id: typeof item.Id === 'number' ? item.Id : Number(item.Id ?? 0) || 0,
		title: toNullableString(item.Title),
		date: toNullableString(item[DAILY_FIELD_DATE]),
		startTime: toNullableString(item[DAILY_FIELD_START_TIME]),
		endTime: toNullableString(item[DAILY_FIELD_END_TIME]),
		location: toNullableString(item[DAILY_FIELD_LOCATION]),
		staffId: toNullableNumber(item[DAILY_FIELD_STAFF_ID]),
		userId: toNullableNumber(item[DAILY_FIELD_USER_ID]),
		notes: toNullableString(item[DAILY_FIELD_NOTES]),
		mealLog: toNullableString(item[DAILY_FIELD_MEAL_LOG]),
		behaviorLog: toNullableString(item[DAILY_FIELD_BEHAVIOR_LOG]),
		draft: parseJsonValue(item[DAILY_FIELD_DRAFT]),
		status: toNullableString(item[DAILY_FIELD_STATUS]),
		modified: typeof item.Modified === 'string' ? item.Modified : undefined,
		created: typeof item.Created === 'string' ? item.Created : undefined,
	};
}

// ─── Schedule mapping extracted to @/lib/mappers/schedule (SSOT) ────────────
// Re-export for backward compatibility
export {
    detectAllDay,
    getScheduleStatusLabel,
    mapSchedule,
    mapScheduleToSp,
    normalizeScheduleStatus,
    toLocalRange,
    type LocalRange,
    type Schedule,
    type ScheduleUpsertInput
} from '@/lib/mappers/schedule';
