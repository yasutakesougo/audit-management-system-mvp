import { useEffect, useMemo, useRef, useState } from 'react';
import { formatInTimeZone } from '@/lib/tz';
import * as ScheduleAdapter from '@/adapters/schedules';
import { isSchedulesFeatureEnabled } from '@/lib/env';
import type { SafeError } from '@/lib/errors';

export type MiniSchedule = {
  id: number;
  title: string;
  startText: string;
  status?: string;
  allDay?: boolean;
};

const TIMEZONE = 'Asia/Tokyo';
const MAX_SAFE_ITEMS = 10;

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
  const abortRef = useRef<AbortController | null>(null);

  const todayISO = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }, []);

  useEffect(() => {
    let alive = true;
    if (!isSchedulesFeatureEnabled()) {
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

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await ScheduleAdapter.list(todayISO, { signal: controller.signal });
        const listResult: ScheduleAdapter.ListResult = Array.isArray(result)
          ? { items: result, source: 'demo' }
          : (result as ScheduleAdapter.ListResult);

        setSource(listResult.source);
        setFallbackKind(listResult.fallbackKind ?? null);
        setFallbackError(listResult.fallbackError ?? null);

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
            let startText = '—';
            if (record.allDay === true) {
              startText = '終日';
            } else if (typeof startIso === 'string' && startIso.trim()) {
              try {
                startText = formatInTimeZone(new Date(startIso), TIMEZONE, 'HH:mm');
              } catch {
                const d = new Date(startIso);
                startText = Number.isNaN(d.getTime()) ? '—' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
              }
            }

            return {
              id: coerceId(record, index + 1),
              title: typeof record.title === 'string' && record.title.trim().length
                ? record.title
                : record.allDay === true
                  ? '終日の予定'
                  : '予定',
              startText,
              status: typeof record.statusLabel === 'string'
                ? record.statusLabel
                : typeof record.status === 'string'
                  ? record.status
                  : undefined,
              allDay: record.allDay === true,
            } satisfies MiniSchedule;
          });

        if (alive) {
          setData(items);
        }
      } catch (err) {
        if (!alive) return;
        if (controller.signal.aborted) {
          setLoading(false);
          return;
        }
        if ((err as Error)?.name === 'AbortError') {
          setLoading(false);
          return;
        }
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [safeMax, todayISO]);

  return {
    data,
    loading,
    error,
    dateISO: todayISO,
    source,
    fallbackKind,
    fallbackError,
  } as const;
}
