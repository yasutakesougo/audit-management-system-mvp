import * as ScheduleAdapter from '@/adapters/schedules';
import {
    calculateRetryAfterTimestamp,
    getNextCooldownTimestamp
} from '@/features/dashboard/logic/syncGuardrails';
import { HYDRATION_FEATURES, estimatePayloadSize, startFeatureSpan } from '@/hydration/features';
import { isSchedulesFeatureEnabled, shouldSkipSharePoint } from '@/lib/env';
import type { SafeError } from '@/lib/errors';
import { formatInTimeZone } from '@/lib/tz';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type MiniSchedule = {
	id: number;
	title: string;
	startText: string;
	status?: string;
	allDay?: boolean;
};

const TIMEZONE = 'Asia/Tokyo';
const MAX_SAFE_ITEMS = 10;
const FALLBACK_MINI_SCHEDULE: Pick<MiniSchedule, 'title' | 'startText' | 'status' | 'allDay'> = {
	title: '予定',
	startText: '—',
	status: undefined,
	allDay: false,
};
const fallbackTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
	timeZone: TIMEZONE,
	hour: '2-digit',
	minute: '2-digit',
	hour12: false,
});

const pad = (value: number) => (value < 10 ? `0${value}` : `${value}`);

const resolveStartIso = (input: Record<string, unknown>): string | null => {
	if (typeof input.startUtc === 'string' && input.startUtc.trim()) {
		return input.startUtc;
	}
	if (typeof input.startLocal === 'string' && input.startLocal.trim()) {
		return input.startLocal;
	}
	if (typeof input.start === 'string' && input.start.trim()) {
		return input.start;
	}
	return null;
};

const coerceId = (row: Record<string, unknown>, fallback: number): number => {
	if (typeof row.id === 'number' && Number.isFinite(row.id)) {
		return row.id;
	}
	if (typeof row.Id === 'number' && Number.isFinite(row.Id)) {
		return row.Id;
	}
	const numeric = Number.parseInt(String(row.id ?? row.Id ?? ''), 10);
	if (Number.isFinite(numeric)) {
		return numeric;
	}
	return fallback;
};



export function useSchedulesToday(max: number = 5) {
	const safeMax = Math.max(0, Math.min(max, MAX_SAFE_ITEMS));
	const [data, setData] = useState<MiniSchedule[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<Error | null>(null);
	const [source, setSource] = useState<ScheduleAdapter.Source>('demo');
	const [fallbackKind, setFallbackKind] = useState<ScheduleAdapter.CreateResult['fallbackKind'] | null>(null);
	const [fallbackError, setFallbackError] = useState<SafeError | null>(null);
	const [tick, setTick] = useState(0);
	const [failureCount, setFailureCount] = useState<number>(0);
	const [retryAfter, setRetryAfter] = useState<number>(0);
	const [cooldownUntil, setCooldownUntil] = useState<number>(0);
	const abortRef = useRef<AbortController | null>(null);

	const refetch = useCallback(() => {
		if (Date.now() < cooldownUntil) {
			return;
		}
		setCooldownUntil(getNextCooldownTimestamp(5000));
		setTick((t) => t + 1);
	}, [cooldownUntil]);

	const todayISO = useMemo(() => {
		const now = new Date();
		return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
	}, []);

	useEffect(() => {
		let alive = true;
		if (!isSchedulesFeatureEnabled() || shouldSkipSharePoint()) {
			setData([]);
			setLoading(false);
			setError(null);
			setSource('demo');
			return () => {
				alive = false;
			};
		}

		const controller = new AbortController();
		abortRef.current?.abort();
		abortRef.current = controller;
		const span = startFeatureSpan(HYDRATION_FEATURES.schedules.load, {
			scope: 'today',
			max: safeMax,
		});
		let spanEnded = false;
		const endSpan = (payload?: Parameters<typeof span>[0]) => {
			if (spanEnded) return;
			span(payload);
			spanEnded = true;
		};

		(async () => {
			try {
				if (typeof window !== 'undefined' && !window.navigator.onLine) {
					throw new Error('Network Error: Offline');
				}
				setLoading(true);
				setError(null);
				if (shouldSkipSharePoint()) {
					// Extra safety within async loop
					throw new Error('SharePoint sync is disabled by configuration.');
				}
				const result = await ScheduleAdapter.list(todayISO, { signal: controller.signal });
				const listResult: ScheduleAdapter.ListResult = Array.isArray(result)
					? { items: result, source: 'demo' }
					: (result as ScheduleAdapter.ListResult);

				setSource(listResult.source);
				setFallbackKind(listResult.fallbackKind ?? null);
				setFallbackError(listResult.fallbackError ?? null);
				setFailureCount(0);
				setRetryAfter(0);

				const rows = Array.isArray(listResult.items) ? listResult.items : [];

				const items = rows
					.filter((row) => Boolean(row) && typeof row === 'object')
					.sort((a, b) => {
						const aIso = resolveStartIso(a as Record<string, unknown>) ?? '';
						const bIso = resolveStartIso(b as Record<string, unknown>) ?? '';
						return aIso.localeCompare(bIso);
					})
					.slice(0, safeMax)
					.map((row, index) => {
						const record = row as Record<string, unknown>;
						const startIso = resolveStartIso(record);
						let startText = FALLBACK_MINI_SCHEDULE.startText;
						if (record.allDay === true) {
							startText = '終日';
						} else if (typeof startIso === 'string' && startIso.trim()) {
							try {
								startText = formatInTimeZone(new Date(startIso), TIMEZONE, 'HH:mm');
							} catch {
								const d = new Date(startIso);
								startText = Number.isNaN(d.getTime())
									? FALLBACK_MINI_SCHEDULE.startText
									: fallbackTimeFormatter.format(d);
							}
						}

						return {
							id: coerceId(record, index + 1),
							title: typeof record.title === 'string' && record.title.trim().length
								? record.title
								: record.allDay === true
									? '終日の予定'
									: FALLBACK_MINI_SCHEDULE.title,
							startText,
							status: typeof record.statusLabel === 'string'
								? record.statusLabel
								: typeof record.status === 'string'
									? record.status
									: undefined,
							allDay: record.allDay === true ? true : FALLBACK_MINI_SCHEDULE.allDay,
						} satisfies MiniSchedule;
					});

				if (alive) {
					setData(items);
				}

				endSpan({
					meta: {
						status: 'ok',
						itemCount: items.length,
						totalCount: rows.length,
						source: listResult.source,
						fallbackKind: listResult.fallbackKind,
						bytes: estimatePayloadSize(rows),
					},
				});
			} catch (err) {
				if (!alive) return;
				if (controller.signal.aborted) {
					setLoading(false);
					endSpan({ meta: { status: 'cancelled' } });
					return;
				}
				if ((err as Error)?.name === 'AbortError') {
					setLoading(false);
					endSpan({ meta: { status: 'cancelled' } });
					return;
				}
				// Handle non-abort errors
				setError(err instanceof Error ? err : new Error(String(err)));
				const nextFailureCount = failureCount + 1;
				setFailureCount(nextFailureCount);
				setRetryAfter(calculateRetryAfterTimestamp(nextFailureCount));

				endSpan({
					meta: { status: 'error' },
					error: err instanceof Error ? err.message : String(err),
				});
			} finally {
				if (alive) {
					setLoading(false);
				}
			}
		})();

		return () => {
			if (!spanEnded) {
				endSpan({ meta: { status: 'cancelled' } });
			}
			alive = false;
			controller.abort();
		};
	}, [safeMax, todayISO, tick, failureCount]); // Add failureCount to dependencies for retryAfter calculation

	return {
		data,
		loading,
		error,
		source,
		fallbackKind,
		fallbackError,
		dateISO: todayISO,
		refetch,
		isFetching: loading,
		failureCount,
		retryAfter,
		cooldownUntil,
	};
}
