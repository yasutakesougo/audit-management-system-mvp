const DEFAULT_LOCALE = 'ja-JP';

const BASE_PARTS_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
	timeZone: 'UTC',
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	hour: '2-digit',
	minute: '2-digit',
	second: '2-digit',
	hour12: false,
	weekday: 'short',
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();
const longWeekdayCache = new Map<string, Intl.DateTimeFormat>();

const getBaseFormatter = (timeZone: string) => {
	const cacheKey = `${timeZone}`;
	let formatter = formatterCache.get(cacheKey);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
			...BASE_PARTS_FORMAT_OPTIONS,
			timeZone,
		});
		formatterCache.set(cacheKey, formatter);
	}
	return formatter;
};

const getLongWeekdayFormatter = (timeZone: string) => {
	let formatter = longWeekdayCache.get(timeZone);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat(DEFAULT_LOCALE, {
			weekday: 'long',
			timeZone,
		});
		longWeekdayCache.set(timeZone, formatter);
	}
	return formatter;
};

const toDate = (value: Date | string): Date => {
	if (value instanceof Date) {
		return new Date(value.getTime());
	}
	return new Date(value);
};

const TIMEZONE_INFO_REGEX = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;
const LOCAL_DATETIME_REGEX =
	/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

const parseDateForTimeZone = (value: string): Date => {
	const trimmed = value.trim();
	if (!trimmed) {
		return new Date(Number.NaN);
	}
	if (TIMEZONE_INFO_REGEX.test(trimmed)) {
		return new Date(trimmed);
	}
	const match = trimmed.match(LOCAL_DATETIME_REGEX);
	if (match) {
		const [, year, month, day, hour = '00', minute = '00', second = '00'] = match;
		const timestamp = Date.UTC(
			Number(year),
			Number(month) - 1,
			Number(day),
			Number(hour),
			Number(minute),
			Number(second),
		);
		return new Date(timestamp);
	}
	const parsed = new Date(trimmed);
	return Number.isNaN(parsed.getTime()) ? new Date(Number.NaN) : parsed;
};

type DateParts = {
	year: string;
	month: string;
	day: string;
	hour: string;
	minute: string;
	second: string;
	weekdayShort: string;
	weekdayLong: string;
};

const extractParts = (date: Date, timeZone: string): DateParts => {
	const baseFormatter = getBaseFormatter(timeZone);
	const parts = baseFormatter.formatToParts(date);
	const map: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
	parts.forEach((part) => {
		if (part.type !== 'literal') {
			map[part.type] = part.value;
		}
	});

	const weekdayLong = getLongWeekdayFormatter(timeZone).format(date);

	return {
		year: map.year ?? '0000',
		month: map.month ?? '01',
		day: map.day ?? '01',
		hour: map.hour ?? '00',
		minute: map.minute ?? '00',
		second: map.second ?? '00',
		weekdayShort: map.weekday ?? '',
		weekdayLong,
	};
};

const applyPattern = (pattern: string, parts: DateParts): string => {
	let result = pattern;
	const replacements: Array<[RegExp, string]> = [
		[/yyyy/g, parts.year],
		[/MM/g, parts.month],
		[/dd/g, parts.day],
		[/HH/g, parts.hour],
		[/mm/g, parts.minute],
		[/ss/g, parts.second],
		[/EEEE/g, parts.weekdayLong],
		[/EEE/g, parts.weekdayShort],
		[/M/g, String(Number(parts.month))],
		[/d/g, String(Number(parts.day))],
	];

	replacements.forEach(([regex, value]) => {
		result = result.replace(regex, value);
	});

	return result;
};

const getTimeZoneOffset = (date: Date, timeZone: string) => {
	const parts = extractParts(date, timeZone);
	const utcTime = Date.UTC(
		Number(parts.year),
		Number(parts.month) - 1,
		Number(parts.day),
		Number(parts.hour),
		Number(parts.minute),
		Number(parts.second),
	);
	return utcTime - date.getTime();
};

export function formatInTimeZone(
	value: Date | string,
	timeZone: string,
	format?: string | Intl.DateTimeFormatOptions,
): string {
	const date = toDate(value);
	if (Number.isNaN(date.getTime())) return '';

	if (format && typeof format === 'object') {
		const options: Intl.DateTimeFormatOptions = {
			timeZone,
			hour12: false,
			...format,
		};
		return new Intl.DateTimeFormat(DEFAULT_LOCALE, options).format(date);
	}

	const pattern = typeof format === 'string' ? format : 'yyyy-MM-dd HH:mm:ss';
	const parts = extractParts(date, timeZone);
	return applyPattern(pattern, parts);
}

export function toZonedTime(value: Date | string, timeZone: string): Date {
	const date = toDate(value);
	if (Number.isNaN(date.getTime())) return date;
	const offset = getTimeZoneOffset(date, timeZone);
	return new Date(date.getTime() + offset);
}

export function fromZonedTime(value: Date | string, timeZone: string): Date {
	const date = typeof value === 'string' ? parseDateForTimeZone(value) : toDate(value);
	if (Number.isNaN(date.getTime())) return date;
	const offset = getTimeZoneOffset(date, timeZone);
	return new Date(date.getTime() - offset);
}

export function toZonedDate(value: Date | string, timeZone: string): Date {
	return toZonedTime(value, timeZone);
}