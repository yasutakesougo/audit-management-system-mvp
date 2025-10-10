import type { Schedule, ScheduleDraft } from './demo';
import * as demo from './demo';

export async function list(dayISO?: string, options?: { signal?: AbortSignal }): Promise<Schedule[]> {
	return demo.list(dayISO, options);
}

export async function create(schedule: ScheduleDraft, options?: { signal?: AbortSignal }): Promise<Schedule> {
	return demo.create(schedule, options);
}

export async function update(
	id: string,
	patch: Partial<Schedule>,
	options?: { signal?: AbortSignal },
): Promise<Schedule> {
	return demo.update(id, patch, options);
}

export async function remove(id: string, options?: { signal?: AbortSignal }): Promise<void> {
	await demo.remove(id, options);
}

export async function checkConflicts(
	assignee: string,
	start: string,
	end: string,
	options?: { signal?: AbortSignal },
): Promise<boolean> {
	return demo.checkConflicts(assignee, start, end, options);
}
