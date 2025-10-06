import type { ScheduleRecurrence, Staff, User } from '@/types';
import {
	DAILY_FIELD_BEHAVIOR_LOG,
	DAILY_FIELD_DATE,
	DAILY_FIELD_DRAFT,
	DAILY_FIELD_END_TIME,
	DAILY_FIELD_LOCATION,
	DAILY_FIELD_MEAL_LOG,
	DAILY_FIELD_NOTES,
	DAILY_FIELD_START_TIME,
	DAILY_FIELD_STATUS,
	DAILY_FIELD_STAFF_ID,
	DAILY_FIELD_USER_ID,
	type DailyRow,
	type ScheduleRow,
	type StaffRow,
	type UserRow,
	SCHEDULE_FIELD_ASSIGNED_STAFF,
	SCHEDULE_FIELD_ASSIGNED_STAFF_ID,
	SCHEDULE_FIELD_BILLING_FLAGS,
	SCHEDULE_FIELD_CREATED_AT,
	SCHEDULE_FIELD_DAY_KEY,
	SCHEDULE_FIELD_END,
	SCHEDULE_FIELD_MONTH_KEY,
	SCHEDULE_FIELD_NOTE,
	SCHEDULE_FIELD_RELATED_RESOURCE,
	SCHEDULE_FIELD_RELATED_RESOURCE_ID,
	SCHEDULE_FIELD_ROW_KEY,
	SCHEDULE_FIELD_SERVICE_TYPE,
	SCHEDULE_FIELD_STATUS,
	SCHEDULE_FIELD_START,
	SCHEDULE_FIELD_TARGET_USER,
	SCHEDULE_FIELD_TARGET_USER_ID,
	SCHEDULE_FIELD_UPDATED_AT,
} from '@/sharepoint/fields';

const normalizeStringArray = (input: unknown): string[] => {
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

const pickField = <T>(item: Record<string, unknown>, ...keys: string[]): T | undefined => {
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

const toNullableString = (value: unknown): string | null => {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed.length ? trimmed : null;
};

const toNullableNumber = (value: unknown): number | null => {
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (typeof value === 'string' && value.trim().length) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
};

const normalizeNumberArray = (input: unknown): number[] => {
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

const parseJsonValue = (value: unknown): unknown => {
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

const SCHEDULE_TIME_ZONE = 'Asia/Tokyo';

const toOffsetString = (offsetMinutes: number): string => {
	const sign = offsetMinutes >= 0 ? '+' : '-';
	const absolute = Math.abs(offsetMinutes);
	const hours = Math.floor(absolute / 60)
		.toString()
		.padStart(2, '0');
	const minutes = (absolute % 60)
		.toString()
		.padStart(2, '0');
	return `${sign}${hours}:${minutes}`;
};

const formatDateTimeInZone = (value: Date, timeZone: string): string | null => {
	try {
		const formatter = new Intl.DateTimeFormat('en-CA', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false,
		});
		const parts = formatter.formatToParts(value);
		const lookup = (type: Intl.DateTimeFormatPart['type']): string =>
			parts.find((part) => part.type === type)?.value ?? '';
		const year = lookup('year');
		const month = lookup('month');
		const day = lookup('day');
		const hour = lookup('hour');
		const minute = lookup('minute');
		const second = lookup('second');
		if (!year || !month || !day || !hour || !minute || !second) {
			return null;
		}
		const numericYear = Number.parseInt(year, 10);
		const numericMonth = Number.parseInt(month, 10);
		const numericDay = Number.parseInt(day, 10);
		const numericHour = Number.parseInt(hour, 10);
		const numericMinute = Number.parseInt(minute, 10);
		const numericSecond = Number.parseInt(second, 10);
		if ([numericYear, numericMonth, numericDay, numericHour, numericMinute, numericSecond].some((n) => !Number.isFinite(n))) {
			return null;
		}
		const targetUtcMs = Date.UTC(
			numericYear,
			numericMonth - 1,
			numericDay,
			numericHour,
			numericMinute,
			numericSecond
		);
		const offsetMinutes = Math.round((targetUtcMs - value.getTime()) / 60_000);
		return `${year}-${month}-${day}T${hour}:${minute}:${second}${toOffsetString(offsetMinutes)}`;
	} catch {
		return null;
	}
};

const formatDateOnlyInZone = (value: Date, timeZone: string): string | null => {
	try {
		const formatter = new Intl.DateTimeFormat('en-CA', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		});
		const parts = formatter.formatToParts(value);
		const lookup = (type: Intl.DateTimeFormatPart['type']): string =>
			parts.find((part) => part.type === type)?.value ?? '';
		const year = lookup('year');
		const month = lookup('month');
		const day = lookup('day');
		if (!year || !month || !day) {
			return null;
		}
		return `${year}-${month}-${day}`;
	} catch {
		return null;
	}
};

const ensureUtcIso = (input?: string | null): string | null => {
	if (!input) return null;
	const trimmed = input.trim();
	if (!trimmed) return null;
	const date = new Date(trimmed);
	if (Number.isNaN(date.getTime())) return trimmed;
	return date.toISOString();
};

type LocalRange = {
	startLocal: string | null;
	endLocal: string | null;
	startDate: string | null;
	endDate: string | null;
};

const toLocalRange = (
	startUtc: string | null,
	endUtc: string | null,
	timeZone: string = SCHEDULE_TIME_ZONE
): LocalRange => {
	const startDate = startUtc ? new Date(startUtc) : null;
	const endDate = endUtc ? new Date(endUtc) : null;
	const isValid = (value: Date | null): value is Date =>
		!!value && !Number.isNaN(value.getTime());
	const safeStart = isValid(startDate) ? startDate : null;
	const safeEnd = isValid(endDate) ? endDate : safeStart;

	const formatDateTime = (value: Date | null): string | null => {
		if (!value) return null;
		return formatDateTimeInZone(value, timeZone);
	};

	const formatDateOnly = (value: Date | null): string | null => {
		if (!value) return null;
		return formatDateOnlyInZone(value, timeZone);
	};

	return {
		startLocal: formatDateTime(safeStart),
		endLocal: formatDateTime(safeEnd),
		startDate: formatDateOnly(safeStart),
		endDate: formatDateOnly(safeEnd),
	};
};

const normalizeScheduleStatus = (value?: string | null): Schedule['status'] => {
	const raw = (value ?? '').trim();
	if (!raw) return 'draft';
	const lower = raw.toLowerCase();
	switch (raw) {
		case '未確定':
			return 'draft';
		case '確定':
		case '完了':
			return 'approved';
		case '実施中':
		case '申請中':
			return 'submitted';
		case 'キャンセル':
			return 'draft';
	}
	switch (lower) {
		case 'draft':
		case 'planned':
		case 'plan':
		case 'pending':
		case 'cancelled':
		case 'canceled':
		case 'cancel':
			return 'draft';
		case 'submitted':
		case 'inprogress':
		case 'in-progress':
			return 'submitted';
		case 'approved':
		case 'confirmed':
		case 'done':
		case 'complete':
		case 'completed':
			return 'approved';
		default:
			return 'draft';
	}
};

const toBoolean = (value: unknown): boolean => {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'string') {
		const trimmed = value.trim().toLowerCase();
		return trimmed === '1' || trimmed === 'true' || trimmed === 'yes';
	}
	if (typeof value === 'number') return value !== 0;
	return false;
};

const detectAllDay = (
	flag: unknown,
	startUtc: string | null,
	endUtc: string | null,
	range: LocalRange
): boolean => {
	if (flag !== undefined && flag !== null) {
		return toBoolean(flag);
	}
	const { startLocal, endLocal } = range;
	if (!startUtc || !endUtc || !startLocal || !endLocal) return false;

	const start = new Date(startUtc);
	const end = new Date(endUtc);
	if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;
	if (end.getTime() < start.getTime()) return false;

	const getTimePortion = (value: string | null): string | null =>
		value ? value.slice(11, 19) : null;

	const startLocalMidnight = getTimePortion(startLocal) === '00:00:00';
	const endLocalMidnight = getTimePortion(endLocal) === '00:00:00';
	const startUtcMidnight = start.getUTCHours() === 0 && start.getUTCMinutes() === 0 && start.getUTCSeconds() === 0;
	const endUtcMidnight = end.getUTCHours() === 0 && end.getUTCMinutes() === 0 && end.getUTCSeconds() === 0;

	return (startLocalMidnight && endLocalMidnight) || (startUtcMidnight && endUtcMidnight);
};

export type Schedule = {
	id: number;
	etag: string | null;
	title: string;
	startUtc: string | null;
	endUtc: string | null;
	startLocal: string | null;
	endLocal: string | null;
	startDate: string | null;
	endDate: string | null;
	allDay: boolean;
	location: string | null;
	staffId: number | null;
	userId: number | null;
	status: 'draft' | 'submitted' | 'approved';
	notes: string | null;
	recurrenceRaw: unknown;
	recurrence?: ScheduleRecurrence;
	created?: string;
	modified?: string;
	category?: string | null;
	serviceType?: string | null;
	personType?: string | null;
	personId?: string | null;
	personName?: string | null;
	staffIds?: string[];
	staffNames?: string[];
	dayPart?: string | null;
	billingFlags?: string[];
	targetUserIds?: number[];
	targetUserNames?: string[];
	relatedResourceIds?: number[];
	relatedResourceNames?: string[];
	rowKey?: string | null;
	dayKey?: string | null;
	monthKey?: string | null;
	createdAt?: string | null;
	updatedAt?: string | null;
	assignedStaffIds?: string[];
	assignedStaffNames?: string[];
	statusLabel?: string;
};

const SCHEDULE_STATUS_LABELS: Record<Schedule['status'], string> = {
	draft: '未確定',
	submitted: '実施中',
	approved: '確定',
};

export function mapSchedule(item: ScheduleRow): Schedule {
	const record = item as Record<string, unknown>;
	const startUtc = ensureUtcIso(
		pickField<string | null>(record, SCHEDULE_FIELD_START, 'EventDate') ?? null
	);
	const endUtc = ensureUtcIso(
		pickField<string | null>(
			record,
			SCHEDULE_FIELD_END,
			'EndDate',
			SCHEDULE_FIELD_START,
			'EventDate'
		) ?? null
	);
	const range = toLocalRange(startUtc, endUtc);
	const recurrenceSource = pickField<string | null>(record, 'RRule', 'RecurrenceData');
	const recurrence: ScheduleRecurrence | undefined = recurrenceSource
		? {
			rule: String(recurrenceSource),
			timezone: SCHEDULE_TIME_ZONE,
			instanceStart: startUtc ?? undefined,
			instanceEnd: endUtc ?? undefined,
		}
		: undefined;
	const rawEtag = (() => {
		const annotation = record['@odata.etag'];
		if (typeof annotation === 'string') return annotation;
		const fallback = record.ETag;
		return typeof fallback === 'string' ? fallback : null;
	})();
	const billingFlags = normalizeStringArray(record[SCHEDULE_FIELD_BILLING_FLAGS] ?? item.BillingFlags);
	const staffIdNumbers = normalizeNumberArray(
		record[SCHEDULE_FIELD_ASSIGNED_STAFF_ID] ?? item.AssignedStaffId ?? record['StaffLookupId']
	);
	const targetUserIdNumbers = normalizeNumberArray(
		record[SCHEDULE_FIELD_TARGET_USER_ID] ?? item.TargetUserId
	);
	const relatedResourceIdNumbers = normalizeNumberArray(
		record[SCHEDULE_FIELD_RELATED_RESOURCE_ID] ?? item.RelatedResourceId
	);
	const resolveLookupTitles = (value: unknown): string[] => {
		if (!value) return [];
		if (Array.isArray(value)) {
			return value
				.map((entry) =>
					entry && typeof entry === 'object' && 'Title' in entry
						? toNullableString((entry as { Title?: unknown }).Title)
						: null
				)
				.filter((title): title is string => !!title);
		}
		if (typeof value === 'object' && value !== null) {
			const results = (value as { results?: unknown }).results;
			if (Array.isArray(results)) {
				return resolveLookupTitles(results);
			}
		}
		return [];
	};
	const staffNamesExpanded = resolveLookupTitles(record[SCHEDULE_FIELD_ASSIGNED_STAFF] ?? item.AssignedStaff);
	const targetUserNamesExpanded = resolveLookupTitles(
		record[SCHEDULE_FIELD_TARGET_USER] ?? item.TargetUser
	);
	const relatedResourceNamesExpanded = resolveLookupTitles(
		record[SCHEDULE_FIELD_RELATED_RESOURCE] ?? item.RelatedResource
	);
	const legacyStaffIds = normalizeStringArray(record['cr014_staffIds']);
	const legacyStaffNames = normalizeStringArray(record['cr014_staffNames']);
	const category = toNullableString(record['cr014_category']);
	const personType = toNullableString(record['cr014_personType']);
	const personId = toNullableString(record['cr014_personId']);
	const personName = toNullableString(record['cr014_personName']);
	const legacyDayPart = toNullableString(record['DayPart'] ?? record['cr014_dayPart']);
	const rowKey = toNullableString(record[SCHEDULE_FIELD_ROW_KEY] ?? item.RowKey);
	const dayKey = toNullableString(record[SCHEDULE_FIELD_DAY_KEY] ?? item.Date ?? record['cr014_dayKey']);
	const monthKey = toNullableString(record[SCHEDULE_FIELD_MONTH_KEY] ?? item.MonthKey);
	const createdAt = toNullableString(record[SCHEDULE_FIELD_CREATED_AT] ?? item.CreatedAt);
	const updatedAt = toNullableString(record[SCHEDULE_FIELD_UPDATED_AT] ?? item.UpdatedAt);
	const staffIdStrings = staffIdNumbers.length ? staffIdNumbers.map(String) : legacyStaffIds;
	const resolvedStaffNames = (() => {
		const names = staffNamesExpanded.length ? staffNamesExpanded : legacyStaffNames;
		return names.length ? names : undefined;
	})();
	const status = normalizeScheduleStatus(toNullableString(record[SCHEDULE_FIELD_STATUS] ?? item.Status));
	return {
		id: typeof item.Id === 'number' ? item.Id : Number(item.Id ?? 0) || 0,
		etag: rawEtag,
		title: toNullableString(record['Title'] ?? item.Title) ?? '',
		startUtc,
		endUtc,
		startLocal: range.startLocal,
		endLocal: range.endLocal,
		startDate: range.startDate,
		endDate: range.endDate,
		allDay: detectAllDay(record['AllDay'] ?? item.AllDay, startUtc, endUtc, range),
		location: toNullableString(record['Location'] ?? item.Location),
		staffId: staffIdNumbers[0] ?? toNullableNumber(item.StaffIdId),
		userId: targetUserIdNumbers[0] ?? toNullableNumber(item.UserIdId),
		status,
		statusLabel: getScheduleStatusLabel(status),
		notes: toNullableString(record[SCHEDULE_FIELD_NOTE] ?? item.Note ?? item.Notes),
		recurrenceRaw: parseJsonValue(record.RecurrenceJson ?? item.RecurrenceJson),
		recurrence,
		modified: typeof item.Modified === 'string' ? item.Modified : undefined,
		created: typeof item.Created === 'string' ? item.Created : undefined,
		category,
		serviceType: toNullableString(record[SCHEDULE_FIELD_SERVICE_TYPE] ?? item.ServiceType),
		personType,
		personId,
		personName,
		staffIds: staffIdStrings,
		assignedStaffIds: staffIdStrings.length ? [...staffIdStrings] : undefined,
		staffNames: resolvedStaffNames,
		assignedStaffNames: resolvedStaffNames ? [...resolvedStaffNames] : undefined,
		dayPart: legacyDayPart,
		billingFlags,
		targetUserIds: targetUserIdNumbers,
		targetUserNames: targetUserNamesExpanded.length ? targetUserNamesExpanded : undefined,
		relatedResourceIds: relatedResourceIdNumbers,
		relatedResourceNames: relatedResourceNamesExpanded.length ? relatedResourceNamesExpanded : undefined,
		rowKey,
		dayKey,
		monthKey,
		createdAt,
		updatedAt,
	};
}
export function getScheduleStatusLabel(status: Schedule['status']): string {
	return SCHEDULE_STATUS_LABELS[status] ?? SCHEDULE_STATUS_LABELS.draft;
}

type ScheduleUpsertStatus = Schedule['status'] | 'planned' | 'confirmed' | 'absent' | 'holiday';

const toSharePointScheduleStatus = (status: ScheduleUpsertStatus): '未確定' | '確定' | '実施中' | '完了' | 'キャンセル' => {
	switch (status) {
		case 'submitted':
			return '実施中';
		case 'approved':
		case 'confirmed':
			return '確定';
		case 'holiday':
			return '完了';
		case 'absent':
			return 'キャンセル';
		case 'planned':
		case 'draft':
		default:
			return '未確定';
	}
};

export type ScheduleUpsertInput = {
	title: string;
	start: string;
	end: string;
	status: ScheduleUpsertStatus;
	note?: string | null;
	targetUserId?: number | string | null;
	billingFlags?: string[] | null;
};

export const mapScheduleToSp = (input: ScheduleUpsertInput): Record<string, unknown> => {
	const startUtc = ensureUtcIso(input.start) ?? input.start;
	const endUtc = ensureUtcIso(input.end) ?? startUtc;
	const payload: Record<string, unknown> = {
		Title: input.title?.trim() ?? '',
		[SCHEDULE_FIELD_START]: startUtc,
		[SCHEDULE_FIELD_END]: endUtc,
		[SCHEDULE_FIELD_STATUS]: toSharePointScheduleStatus(input.status),
		[SCHEDULE_FIELD_NOTE]: input.note ?? null,
	};

	if (input.targetUserId !== undefined) {
		const targetId = toNullableNumber(input.targetUserId);
		payload[SCHEDULE_FIELD_TARGET_USER_ID] = targetId != null ? { results: [targetId] } : { results: [] };
	}

	if (input.billingFlags !== undefined) {
		const flags = normalizeStringArray(input.billingFlags);
		payload[SCHEDULE_FIELD_BILLING_FLAGS] = { results: flags };
	}

	return payload;
};

export type { LocalRange };
export { toLocalRange, detectAllDay };