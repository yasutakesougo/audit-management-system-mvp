import { isDemoModeEnabled, isDevMode } from '@/lib/env';
import { withAudit } from '@/lib/auditWrap';
import type { ScheduleForm } from './types';

type UserMessageError = Error & { userMessage?: string };

const createUserMessageError = (message: string, cause?: unknown): UserMessageError => {
	if (cause instanceof Error) {
		const err = cause as UserMessageError;
		if (!err.userMessage) {
			err.userMessage = message;
		}
		return err;
	}

	const err = new Error(message) as UserMessageError;
	err.userMessage = message;
	return err;
};

const shouldUseDemoData = (): boolean => isDemoModeEnabled() || isDevMode();

const DEMO_ITEMS: ScheduleForm[] = (() => {
	const today = new Date();
	const startOfDay = (dayOffset: number, hour: number): string => {
		const base = new Date(today);
		base.setHours(0, 0, 0, 0);
		base.setDate(base.getDate() + dayOffset);
		base.setHours(hour, 0, 0, 0);
		return base.toISOString();
	};

	const endOfDay = (dayOffset: number, hour: number): string => {
		const base = new Date(today);
		base.setHours(0, 0, 0, 0);
		base.setDate(base.getDate() + dayOffset);
		base.setHours(hour, 0, 0, 0);
		return base.toISOString();
	};

	return [
		{
			id: 1,
			userId: 'U-0001',
			title: '訪問介護',
			note: '午前は自宅訪問',
			status: 'planned',
			start: startOfDay(0, 9),
			end: endOfDay(0, 11),
		},
		{
			id: 2,
			userId: 'U-0002',
			title: 'ショートステイ送迎',
			note: '駅前集合',
			status: 'confirmed',
			start: startOfDay(2, 13),
			end: endOfDay(2, 16),
		},
	];
})();

const demoStore = new Map<number, ScheduleForm>(DEMO_ITEMS.map((item) => [item.id!, { ...item }]));
let demoCounter = DEMO_ITEMS.reduce((max, item) => (item.id && item.id > max ? item.id : max), 0);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const withinRange = (item: ScheduleForm, fromIso: string, toIso: string): boolean => {
	const start = new Date(item.start).getTime();
	const end = new Date(item.end).getTime();
	const from = new Date(fromIso).getTime();
	const to = new Date(toIso).getTime();
	return Number.isFinite(start) && Number.isFinite(end) && start < to && end > from;
};

const listSchedulesFromDemo = async ({ from, to }: { from: string; to: string }): Promise<ScheduleForm[]> => {
	await delay(120);
	return Array.from(demoStore.values())
		.filter((item) => withinRange(item, from, to))
		.map((item) => ({ ...item }));
};

const createScheduleInDemo = async (input: ScheduleForm): Promise<void> => {
	await delay(120);
	demoCounter += 1;
	demoStore.set(demoCounter, { ...input, id: demoCounter });
};

const updateScheduleInDemo = async (id: number, patch: Partial<ScheduleForm>): Promise<void> => {
	await delay(120);
	const existing = demoStore.get(id);
	if (!existing) {
		throw createUserMessageError('予定が見つかりませんでした');
	}
	demoStore.set(id, { ...existing, ...patch, id });
};

const notImplemented = (operation: string): never => {
	throw createUserMessageError(`スケジュールの${operation}処理が未設定です。`, new Error('TODO: SharePoint wiring'));
};

export async function listSchedules({ from, to }: { from: string; to: string }): Promise<ScheduleForm[]> {
	try {
		if (!shouldUseDemoData()) {
			// TODO: Wire to SharePoint schedules list via spClient helpers.
			return notImplemented('取得');
		}
	} catch (error) {
		if (!shouldUseDemoData()) {
			throw createUserMessageError('予定の取得に失敗しました', error);
		}
	}

	return listSchedulesFromDemo({ from, to });
}

export async function createSchedule(input: ScheduleForm): Promise<void> {
	try {
		if (!shouldUseDemoData()) {
			// TODO: Wire to SharePoint create handler once available.
			return notImplemented('作成');
		}
	} catch (error) {
		if (!shouldUseDemoData()) {
			throw createUserMessageError('予定の作成に失敗しました', error);
		}
	}

	await withAudit({ baseAction: 'CREATE', entity: 'Schedules', before: { input } }, () => createScheduleInDemo(input));
}

export async function updateSchedule(id: number, patch: Partial<ScheduleForm>): Promise<void> {
	try {
		if (!shouldUseDemoData()) {
			// TODO: Wire to SharePoint update handler once available.
			return notImplemented('更新');
		}
	} catch (error) {
		if (!shouldUseDemoData()) {
			throw createUserMessageError('予定の更新に失敗しました', error);
		}
	}

	await withAudit({ baseAction: 'UPDATE', entity: 'Schedules', before: { id, patch } }, () => updateScheduleInDemo(id, patch));
}
