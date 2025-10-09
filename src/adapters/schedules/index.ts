import { allowWriteFallback, isDemoModeEnabled } from '../../lib/env';
import { toSafeError, type SafeError } from '../../lib/errors';
import { withUserMessage } from '../../lib/notice';
import * as demo from './demo';
import * as sharepoint from './sharepoint';

export type { Schedule, ScheduleDraft } from './demo';

export type Source = 'demo' | 'sharepoint';

export type CreateResult = {
	schedule: demo.Schedule;
	source: Source;
	fallbackError?: SafeError;
	fallbackKind?: 'network' | 'auth' | 'schema' | 'unknown';
};

export type ListResult = {
	items: demo.Schedule[];
	source: Source;
	fallbackError?: SafeError;
	fallbackKind?: CreateResult['fallbackKind'];
};

const isDemo = () => isDemoModeEnabled();

const classifyError = (error: SafeError): CreateResult['fallbackKind'] => {
	const normalized = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
	if (
		normalized.includes('interaction_required') ||
		normalized.includes('consent_required') ||
		normalized.includes('login_required') ||
		normalized.includes('no signed-in account') ||
		normalized.includes('aadsts70011') ||
		normalized.includes(".default scope can't be combined") ||
		/401|403|unauthor/.test(normalized)
	) {
		return 'auth';
	}
	if (/429|503|504|network|fetch|timeout/.test(normalized)) {
		return 'network';
	}
	if (/does not exist|property|field|schema|invalid/.test(normalized)) {
		return 'schema';
	}
	return 'unknown';
};

const warned = new Set<string>();
const warnOnceWith = (message: string, error: unknown): SafeError => {
	const safe = withUserMessage(toSafeError(error));
	const key = `${message}::${classifyError(safe)}`;
	if (!warned.has(key)) {
		warned.add(key);
		console.warn(message, safe.userMessage ?? safe.message, safe);
	}
	return safe;
};

const isDateISO = (value?: string) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

export async function list(dayISO?: string, options?: { signal?: AbortSignal }): Promise<ListResult> {
	if (isDemo()) return { items: await demo.list(dayISO, options), source: 'demo' };
	try {
		if (dayISO && !isDateISO(dayISO)) throw new Error(`invalid dayISO: ${dayISO}`);
		const items = await sharepoint.list(dayISO, options);
		return { items, source: 'sharepoint' };
	} catch (error: unknown) {
		const safe = warnOnceWith('[schedules] SharePoint list failed, falling back to demo data.', error);
		if (options?.signal?.aborted) {
			throw safe;
		}
		return {
			items: await demo.list(dayISO, options),
			source: 'demo',
			fallbackError: safe,
			fallbackKind: classifyError(safe),
		};
	}
}

export async function create(schedule: demo.ScheduleDraft, options?: { signal?: AbortSignal }): Promise<CreateResult> {
	if (isDemo()) {
		const result = await demo.create(schedule, options);
		return { schedule: result, source: 'demo' };
	}
	try {
		const created = await sharepoint.create(schedule, options);
		return { schedule: created, source: 'sharepoint' };
	} catch (error: unknown) {
		const safe = warnOnceWith('[schedules] SharePoint create failed, falling back to demo.', error);
		if (!allowWriteFallback() || options?.signal?.aborted) {
			throw safe;
		}
		const fallback = await demo.create(schedule, options);
		return {
			schedule: fallback,
			source: 'demo',
			fallbackError: safe,
			fallbackKind: classifyError(safe),
		};
	}
}

export async function update(id: string, patch: Partial<demo.Schedule>, options?: { signal?: AbortSignal }) {
	if (isDemo()) return demo.update(id, patch, options);
	try {
		return await sharepoint.update(id, patch, options);
	} catch (error: unknown) {
		const safe = warnOnceWith('[schedules] SharePoint update failed, falling back to demo.', error);
		if (!allowWriteFallback() || options?.signal?.aborted) {
			throw safe;
		}
		return demo.update(id, patch, options);
	}
}

export async function remove(id: string, options?: { signal?: AbortSignal }) {
	if (isDemo()) return demo.remove(id, options);
	try {
		return await sharepoint.remove(id, options);
	} catch (error: unknown) {
		const safe = warnOnceWith('[schedules] SharePoint remove failed, falling back to demo.', error);
		if (!allowWriteFallback() || options?.signal?.aborted) {
			throw safe;
		}
		return demo.remove(id, options);
	}
}

export async function checkConflicts(
	assignee: string,
	start: string,
	end: string,
	options?: { signal?: AbortSignal }
) {
	if (isDemo()) return demo.checkConflicts(assignee, start, end, options);
	try {
		return await sharepoint.checkConflicts(assignee, start, end, options);
	} catch (error: unknown) {
		const safe = warnOnceWith('[schedules] SharePoint conflict-check failed, falling back to demo.', error);
		if (options?.signal?.aborted) {
			throw safe;
		}
		return demo.checkConflicts(assignee, start, end, options);
	}
}

// test-only utility to clear warning guard
export const __resetSchedulesWarningForTest = () => {
	warned.clear();
};
