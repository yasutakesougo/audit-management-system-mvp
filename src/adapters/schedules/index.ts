import * as demo from '@/adapters/schedules/demo';
import * as sharepoint from '@/adapters/schedules/sharepoint';
import { HYDRATION_FEATURES, startFeatureSpan } from '@/hydration/features';
import { allowWriteFallback, isDemoModeEnabled } from '@/lib/env';
import { toSafeError, type SafeError } from '@/lib/errors';
import { withUserMessage } from '@/lib/notice';

export type { Schedule, ScheduleDraft } from '@/adapters/schedules/demo';

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

/**
 * Classify SharePoint errors into categories for better fallback handling and metrics.
 * This helps distinguish between temporary network issues vs. permanent config problems.
 */
const classifyError = (error: SafeError): CreateResult['fallbackKind'] => {
	const normalized = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
	// Authentication and authorization issues
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
	// Network and temporary service issues
	if (/429|503|504|network|fetch|timeout/.test(normalized)) {
		return 'network';
	}
	// Schema and configuration issues
	if (/does not exist|property|field|schema|invalid/.test(normalized)) {
		return 'schema';
	}
	return 'unknown';
};

const warned = new Set<string>();

const beginWriteSpan = (operation: string) => {
	const complete = startFeatureSpan(HYDRATION_FEATURES.schedules.write, { operation });
	let closed = false;
	return (payload?: Parameters<typeof complete>[0]) => {
		if (closed) return;
		closed = true;
		complete(payload);
	};
};

/**
 * Warn about fallback usage, but only once per error type to avoid log spam.
 * The warning key combines message and error kind, allowing for future metrics collection.
 * TODO: Consider adding metricsReporter integration here for production monitoring.
 */
const warnOnceWith = (message: string, error: unknown): SafeError => {
	const safe = withUserMessage(toSafeError(error));
	const kind = classifyError(safe);
	const key = `${message}::${kind}`;
	if (!warned.has(key)) {
		warned.add(key);
		console.warn(message, safe.userMessage ?? safe.message, safe);
		// TODO: Future enhancement - report to metrics system:
		// metricsReporter?.reportFallback({ operation: message, errorKind: kind, error: safe });
	}
	return safe;
};

const isDateISO = (value?: string) => !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

export async function list(dayISO?: string, options?: { signal?: AbortSignal }): Promise<ListResult> {
	if (isDemo()) return { items: await demo.list(dayISO, options), source: 'demo' };

	// Validate arguments early - developer errors should not fallback
	if (dayISO && !isDateISO(dayISO)) {
		throw new Error(`invalid dayISO: ${dayISO}`);
	}

	try {
		const items = await sharepoint.list(dayISO, options);
		return { items, source: 'sharepoint' };
	} catch (error: unknown) {
		const safe = warnOnceWith('[schedules] SharePoint list failed, falling back to demo data.', error);
		const kind = classifyError(safe);
		if (options?.signal?.aborted) {
			throw safe;
		}
		return {
			items: await demo.list(dayISO, options),
			source: 'demo',
			fallbackError: safe,
			fallbackKind: kind,
		};
	}
}

export async function create(schedule: demo.ScheduleDraft, options?: { signal?: AbortSignal }): Promise<CreateResult> {
	const finishSpan = beginWriteSpan('create');
	try {
		if (isDemo()) {
			const result = await demo.create(schedule, options);
			finishSpan({ meta: { status: 'ok', mode: 'demo' } });
			return { schedule: result, source: 'demo' };
		}
		try {
			const created = await sharepoint.create(schedule, options);
			finishSpan({ meta: { status: 'ok', mode: 'sharepoint' } });
			return { schedule: created, source: 'sharepoint' };
		} catch (error: unknown) {
			const safe = warnOnceWith('[schedules] SharePoint create failed, falling back to demo.', error);
			const kind = classifyError(safe);
			if (!allowWriteFallback() || options?.signal?.aborted) {
				finishSpan({ meta: { status: 'error', mode: 'sharepoint' }, error: safe.message });
				throw safe;
			}
			const fallback = await demo.create(schedule, options);
			finishSpan({ meta: { status: 'fallback', mode: 'demo', fallbackKind: kind } });
			return {
				schedule: fallback,
				source: 'demo',
				fallbackError: safe,
				fallbackKind: kind,
			};
		}
	} catch (error) {
		finishSpan({
			meta: { status: 'error' },
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}

export async function update(id: string, patch: Partial<demo.Schedule>, options?: { signal?: AbortSignal }) {
	const finishSpan = beginWriteSpan('update');
	try {
		if (isDemo()) {
			const result = await demo.update(id, patch, options);
			finishSpan({ meta: { status: 'ok', mode: 'demo' } });
			return result;
		}
		try {
			const result = await sharepoint.update(id, patch, options);
			finishSpan({ meta: { status: 'ok', mode: 'sharepoint' } });
			return result;
		} catch (error: unknown) {
			const safe = warnOnceWith('[schedules] SharePoint update failed, falling back to demo.', error);
			if (!allowWriteFallback() || options?.signal?.aborted) {
				finishSpan({ meta: { status: 'error', mode: 'sharepoint' }, error: safe.message });
				throw safe;
			}
			const fallback = await demo.update(id, patch, options);
			finishSpan({ meta: { status: 'fallback', mode: 'demo' } });
			return fallback;
		}
	} catch (error) {
		finishSpan({
			meta: { status: 'error' },
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}

export async function remove(id: string, options?: { signal?: AbortSignal }) {
	const finishSpan = beginWriteSpan('remove');
	try {
		if (isDemo()) {
			const result = await demo.remove(id, options);
			finishSpan({ meta: { status: 'ok', mode: 'demo' } });
			return result;
		}
		try {
			const result = await sharepoint.remove(id, options);
			finishSpan({ meta: { status: 'ok', mode: 'sharepoint' } });
			return result;
		} catch (error: unknown) {
			const safe = warnOnceWith('[schedules] SharePoint remove failed, falling back to demo.', error);
			if (!allowWriteFallback() || options?.signal?.aborted) {
				finishSpan({ meta: { status: 'error', mode: 'sharepoint' }, error: safe.message });
				throw safe;
			}
			const fallback = await demo.remove(id, options);
			finishSpan({ meta: { status: 'fallback', mode: 'demo' } });
			return fallback;
		}
	} catch (error) {
		finishSpan({
			meta: { status: 'error' },
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
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
