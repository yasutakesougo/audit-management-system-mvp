/**
 * Schedule Mapping — SP Row → App Domain
 *
 * mappers.ts から抽出。スケジュール関連のタイムゾーン変換、
 * ステータス正規化、SP↔App マッピング。
 */
import {
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
    SCHEDULE_FIELD_START,
    SCHEDULE_FIELD_STATUS,
    SCHEDULE_FIELD_TARGET_USER,
    SCHEDULE_FIELD_TARGET_USER_ID,
    SCHEDULE_FIELD_UPDATED_AT,
    type ScheduleRow,
} from '@/sharepoint/fields';
import type { ServiceType } from '@/sharepoint/serviceTypes';
import { normalizeServiceType } from '@/sharepoint/serviceTypes';
import type { ScheduleRecurrence } from '@/types';

// ─── Shared utilities (imported from parent mappers for DRY) ─────
// These are re-used from the main mappers module to avoid duplication
import {
    normalizeNumberArray,
    normalizeStringArray,
    parseJsonValue,
    pickField,
    toNullableNumber,
    toNullableString,
} from '@/lib/mappers';

// ─── Timezone helpers ────────────────────────────────────────────

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

// ─── LocalRange ──────────────────────────────────────────────────

export type LocalRange = {
	startLocal: string | null;
	endLocal: string | null;
	startDate: string | null;
	endDate: string | null;
};

export const toLocalRange = (
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

// ─── Schedule status ─────────────────────────────────────────────

export const normalizeScheduleStatus = (value?: string | null): Schedule['status'] => {
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

// ─── All-day detection ───────────────────────────────────────────

const toBoolean = (value: unknown): boolean => {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'string') {
		const trimmed = value.trim().toLowerCase();
		return trimmed === '1' || trimmed === 'true' || trimmed === 'yes';
	}
	if (typeof value === 'number') return value !== 0;
	return false;
};

export const detectAllDay = (
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

// ─── Schedule type ───────────────────────────────────────────────

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
	serviceType?: ServiceType | null;
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

// ─── mapSchedule ─────────────────────────────────────────────────

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
		serviceType: normalizeServiceType(toNullableString(record[SCHEDULE_FIELD_SERVICE_TYPE] ?? item.ServiceType)),
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

// ─── Schedule upsert ─────────────────────────────────────────────

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
