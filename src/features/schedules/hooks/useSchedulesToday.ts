import {
	calculateRetryAfterTimestamp,
	getNextCooldownTimestamp
} from '@/features/dashboard/logic/syncGuardrails';
import { HYDRATION_FEATURES, estimatePayloadSize, startFeatureSpan } from '@/hydration/features';
import { isSchedulesFeatureEnabled, shouldSkipSharePoint } from '@/lib/env';
import { formatInTimeZone } from '@/lib/tz';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ScheduleItem } from '../domain/ScheduleRepository';
import { getCurrentScheduleRepositoryKind, useScheduleRepository } from '../repositoryFactory';

export type MiniSchedule = {
	id: number;
	title: string;
	startText: string;
	status?: string;
	allDay?: boolean;
};

const TIMEZONE = 'Asia/Tokyo';
const MAX_SAFE_ITEMS = 10;
const FALLBACK_START_TEXT = '—';

const pad = (value: number) => (value < 10 ? `0${value}` : `${value}`);

/** Build JST day boundaries for repository.list() DateRange */
const buildDateRange = (dateISO: string) => ({
	from: `${dateISO}T00:00:00+09:00`,
	to: `${dateISO}T23:59:59+09:00`,
});

const fallbackTimeFormatter = new Intl.DateTimeFormat('ja-JP', {
	timeZone: TIMEZONE,
	hour: '2-digit',
	minute: '2-digit',
	hour12: false,
});

/** Convert a typed ScheduleItem to a MiniSchedule for the dashboard widget */
const toMiniSchedule = (item: ScheduleItem, index: number): MiniSchedule => {
	let startText = FALLBACK_START_TEXT;
	if (item.allDay) {
		startText = '終日';
	} else if (item.start?.trim()) {
		try {
			startText = formatInTimeZone(new Date(item.start), TIMEZONE, 'HH:mm');
		} catch {
			const d = new Date(item.start);
			startText = Number.isNaN(d.getTime())
				? FALLBACK_START_TEXT
				: fallbackTimeFormatter.format(d);
		}
	}

	const numericId = Number.parseInt(item.id, 10);

	return {
		id: Number.isFinite(numericId) ? numericId : index + 1,
		title: item.title?.trim() || (item.allDay ? '終日の予定' : '予定'),
		startText,
		status: item.status ?? undefined,
		allDay: item.allDay === true,
	};
};

export type ScheduleSource = 'demo' | 'sharepoint';

export function useSchedulesToday(max: number = 5) {
	const safeMax = Math.max(0, Math.min(max, MAX_SAFE_ITEMS));
	const repository = useScheduleRepository();

	const [data, setData] = useState<MiniSchedule[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [error, setError] = useState<Error | null>(null);
	const [tick, setTick] = useState(0);
	const [failureCount, setFailureCount] = useState<number>(0);
	const [retryAfter, setRetryAfter] = useState<number>(0);
	const [cooldownUntil, setCooldownUntil] = useState<number>(0);
	const abortRef = useRef<AbortController | null>(null);

	const source = useMemo<ScheduleSource>(
		() => getCurrentScheduleRepositoryKind(),
		[repository],
	);

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

				const range = buildDateRange(todayISO);
				const rows = await repository.list({
					range,
					signal: controller.signal,
				});

				setFailureCount(0);
				setRetryAfter(0);

				const sortedRows = [...rows].sort((a, b) =>
					(a.start ?? '').localeCompare(b.start ?? ''),
				);
				const items = sortedRows
					.slice(0, safeMax)
					.map(toMiniSchedule);

				if (alive) {
					setData(items);
				}

				endSpan({
					meta: {
						status: 'ok',
						itemCount: items.length,
						totalCount: rows.length,
						source,
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
	}, [safeMax, todayISO, tick, failureCount, repository, source]);

	return {
		data,
		loading,
		error,
		source,
		/** @deprecated fallbackKind removed – repository handles fallback internally */
		fallbackKind: null,
		/** @deprecated fallbackError removed – repository handles fallback internally */
		fallbackError: null,
		dateISO: todayISO,
		refetch,
		isFetching: loading,
		failureCount,
		retryAfter,
		cooldownUntil,
	};
}
