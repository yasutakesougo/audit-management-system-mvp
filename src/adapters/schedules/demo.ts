import { set } from 'date-fns';

type AbortableOptions = { signal?: AbortSignal } | undefined;

export type ScheduleStatus = 'planned' | 'confirmed' | 'absent' | 'holiday';

export type Schedule = {
	id: string;
	assignee: string;
	title: string;
	note?: string;
	status: ScheduleStatus;
	start: string;
	end: string;
	createdAt: string;
	updatedAt: string;
};

export type ScheduleDraft = {
	assignee: string;
	title: string;
	note?: string;
	status?: ScheduleStatus;
	start: string;
	end: string;
};

const SCHEDULE_TIME_ZONE = 'Asia/Tokyo';

const store = new Map<string, Schedule>();

const nowIso = () => new Date().toISOString();

const generateId = (): string => {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}
	return `sched-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
};

const toDayKey = (iso: string): string => {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return '';
	return new Intl.DateTimeFormat('ja-JP', {
		timeZone: SCHEDULE_TIME_ZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	})
		.format(date)
		.split('/')
		.join('-');
};

const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string): boolean => {
	const startA = new Date(aStart).getTime();
	const endA = new Date(aEnd).getTime();
	const startB = new Date(bStart).getTime();
	const endB = new Date(bEnd).getTime();
	if ([startA, endA, startB, endB].some((value) => Number.isNaN(value))) {
		return false;
	}
	return startA < endB && startB < endA;
};

const abortIfNeeded = (options?: AbortableOptions) => {
	const signal = options?.signal;
	if (signal?.aborted) {
		throw signal.reason instanceof Error
			? signal.reason
			: new DOMException('The operation was aborted.', 'AbortError');
	}
};

const seed = () => {
	const base = set(new Date(), { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 });
	const item: Schedule = {
		id: generateId(),
		assignee: 'staff-001',
		title: '訪問介護（午前）',
		status: 'planned',
		note: '集合 8:30 / 送迎あり',
		start: new Date(base).toISOString(),
		end: new Date(base.getTime() + 2 * 60 * 60 * 1000).toISOString(),
		createdAt: nowIso(),
		updatedAt: nowIso(),
	};
	store.set(item.id, item);
};

seed();

export async function list(dayISO?: string, options?: AbortableOptions): Promise<Schedule[]> {
	abortIfNeeded(options);
	const items = Array.from(store.values());
	if (!dayISO) {
		return items.map((item) => ({ ...item }));
	}
	const targetKey = toDayKey(dayISO);
	return items
		.filter((item) => toDayKey(item.start) === targetKey || toDayKey(item.end) === targetKey)
		.map((item) => ({ ...item }));
}

export async function create(draft: ScheduleDraft, options?: AbortableOptions): Promise<Schedule> {
	abortIfNeeded(options);
	const id = generateId();
	const now = nowIso();
	const schedule: Schedule = {
		id,
		assignee: draft.assignee,
		title: draft.title,
		note: draft.note,
		status: draft.status ?? 'planned',
		start: draft.start,
		end: draft.end,
		createdAt: now,
		updatedAt: now,
	};
	store.set(id, schedule);
	return { ...schedule };
}

export async function update(
	id: string,
	patch: Partial<Schedule>,
	options?: AbortableOptions,
): Promise<Schedule> {
	abortIfNeeded(options);
	const existing = store.get(id);
	if (!existing) {
		throw new Error(`Schedule ${id} not found`);
	}
	const next: Schedule = {
		...existing,
		...patch,
		id: existing.id,
		updatedAt: nowIso(),
	};
	store.set(id, next);
	return { ...next };
}

export async function remove(id: string, options?: AbortableOptions): Promise<void> {
	abortIfNeeded(options);
	store.delete(id);
}

export async function checkConflicts(
	assignee: string,
	start: string,
	end: string,
	options?: AbortableOptions,
): Promise<boolean> {
	abortIfNeeded(options);
	return Array.from(store.values()).some((item) => {
		if (item.assignee !== assignee) {
			return false;
		}
		return overlaps(item.start, item.end, start, end);
	});
}

export function __resetForTests() {
	store.clear();
	seed();
}
