import type { Schedule } from '@/lib/mappers';
import type { ServiceType } from '@/sharepoint/serviceTypes';
import { useCallback, useEffect, useMemo, useState } from 'react';

const now = new Date();
const toIso = (date: Date) => date.toISOString();
const addHours = (date: Date, hours: number) => new Date(date.getTime() + hours * 60 * 60 * 1000);
const delay = (ms = 0) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const sanitizeOverrides = <T extends Record<string, unknown>>(input: Partial<T>): Partial<T> =>
	Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined)) as Partial<T>;

const makeSchedule = (id: number, rawOverrides: Partial<Schedule>): Schedule => {
	const overrides = sanitizeOverrides<Schedule>(rawOverrides);
	const start = overrides.startUtc ? new Date(overrides.startUtc) : addHours(now, id);
	const end = overrides.endUtc ? new Date(overrides.endUtc) : addHours(start, 1);
	const startIso = toIso(start);
	const endIso = toIso(end);
	const derivedDayKey = startIso.slice(0, 10).replace(/-/g, '');
	const derivedMonthKey = startIso.slice(0, 7).replace(/-/g, '');

	const base: Schedule = {
		id,
		etag: `W/"demo-${id}"`,
		title: `デモ予定 ${id}`,
		startUtc: startIso,
		endUtc: endIso,
		startLocal: startIso,
		endLocal: endIso,
		startDate: startIso.slice(0, 10),
		endDate: endIso.slice(0, 10),
		allDay: false,
		location: '多目的室',
		staffId: id,
		userId: id,
		status: 'approved',
		notes: 'デモデータ',
		recurrenceRaw: null,
		recurrence: undefined,
		created: startIso,
		modified: endIso,
		category: 'User',
		serviceType: '一時ケア' as ServiceType,
		personType: 'Internal',
		personId: String(id),
		personName: `利用者 ${id}`,
		staffIds: [String(id)],
		staffNames: [`スタッフ ${id}`],
		dayPart: null,
		billingFlags: [],
		targetUserIds: [id],
		targetUserNames: [`利用者 ${id}`],
		relatedResourceIds: [],
		relatedResourceNames: [],
		dayKey: derivedDayKey,
		monthKey: derivedMonthKey,
		rowKey: `row-${id}`,
		createdAt: startIso,
		updatedAt: endIso,
		assignedStaffIds: [String(id)],
		assignedStaffNames: [`スタッフ ${id}`],
		statusLabel: '承認済み',
	};

	const next = {
		...base,
		...overrides,
	} as Schedule;

	if (!next.dayKey) {
		const source = next.startUtc ?? next.startLocal ?? null;
		next.dayKey = source ? source.slice(0, 10).replace(/-/g, '') : derivedDayKey;
	}

	if (!next.monthKey) {
		const source = next.startUtc ?? next.startLocal ?? null;
		next.monthKey = source ? source.slice(0, 7).replace(/-/g, '') : derivedMonthKey;
	}

	if (!next.startLocal && next.startUtc) {
		next.startLocal = next.startUtc;
	}
	if (!next.endLocal && next.endUtc) {
		next.endLocal = next.endUtc;
	}

	return next;
};

const DEMO_SCHEDULES: Schedule[] = [
	makeSchedule(1, {
		category: 'User',
		serviceType: 'ショートステイ' as ServiceType,
		personType: 'Internal',
		personName: '山田 太郎',
		staffIds: ['101', '102'],
		staffNames: ['佐藤 花子', '鈴木 次郎'],
		targetUserNames: ['山田 太郎'],
	}),
	makeSchedule(2, {
		category: 'Org',
		staffId: null,
		staffIds: [],
		staffNames: [],
		personType: null,
		serviceType: null,
		userId: null,
		targetUserIds: [],
		targetUserNames: [],
		relatedResourceNames: ['会議室 A'],
		relatedResourceIds: [501],
		location: '会議室 A',
		notes: '全体会議',
	}),
	makeSchedule(3, {
		category: 'Staff',
		staffId: 103,
		staffIds: ['103'],
		staffNames: ['高橋 三郎'],
		personType: null,
		personId: null,
		personName: null,
		serviceType: null,
		userId: null,
		dayPart: 'AM',
	}),
];

const fetchDemoSchedules = async (): Promise<Schedule[]> => {
  await delay();
  return DEMO_SCHEDULES.map((item) => ({ ...item }));
};

export function useSchedules() {
  const [data, setData] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const next = await fetchDemoSchedules();
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const byId = useMemo(
    () => new Map<number, Schedule>(data.map((item) => [item.id, item])),
    [data]
  );

  return {
    data,
    loading,
    error,
    reload,
    byId,
    schedules: data,
    isLoading: loading,
    load: reload,
  };
}
