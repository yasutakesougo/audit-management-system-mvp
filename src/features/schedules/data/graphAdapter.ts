import { getAppConfig, readOptionalEnv } from '@/lib/env';
import { toSafeError } from '@/lib/errors';
import { withUserMessage } from '@/lib/notice';
import type { Event as GraphEvent } from '@microsoft/microsoft-graph-types';
import type { SchedItem, SchedulesPort } from './port';

type GetToken = () => Promise<string | null>;

type GraphSchedulesPortOptions = {
  create?: SchedulesPort['create'];
};

const DEFAULT_TIMEZONE = 'Asia/Tokyo';

const resolveTimezone = (): string =>
  readOptionalEnv('VITE_SCHEDULES_TZ') ??
  Intl.DateTimeFormat().resolvedOptions().timeZone ??
  DEFAULT_TIMEZONE;

const normalizeTitle = (subject?: string): string => {
  if (!subject) return '(無題)';
  const trimmed = subject.trim();
  return trimmed.length > 0 ? trimmed : '(無題)';
};

const normalizeIso = (value?: string): string | null => {
  if (!value) return null;
  return value;
};

const fallbackId = (event: GraphEvent): string => {
  if (event.id && event.id.trim()) {
    return event.id.trim();
  }
  const stamp = event.start?.dateTime ?? event.end?.dateTime ?? `${Date.now()}`;
  return `graph-${stamp}`;
};

const mapGraphEventToItem = (event: GraphEvent): SchedItem | null => {
  const start = normalizeIso(event.start?.dateTime);
  const end = normalizeIso(event.end?.dateTime);
  if (!start || !end) {
    return null;
  }

  const assignedTo =
    event.organizer?.emailAddress?.address?.trim() ||
    (event as { createdBy?: { user?: { email?: string } } }).createdBy?.user?.email?.trim() ||
    null;

  return {
    id: fallbackId(event),
    title: normalizeTitle(event.subject ?? undefined),
    start,
    end,
    assignedTo: assignedTo ? assignedTo.toLowerCase() : null,
  };
};

export const makeGraphSchedulesPort = (getToken: GetToken, options?: GraphSchedulesPortOptions): SchedulesPort => {
  const timezone = resolveTimezone();
  const { schedulesCacheTtlSec, graphRetryMax, graphRetryBaseMs, graphRetryCapMs } = getAppConfig();
  const cacheTtlMs = Math.max(0, schedulesCacheTtlSec) * 1000;
  const retryMax = Math.max(0, graphRetryMax);
  const retryBase = Math.max(0, graphRetryBaseMs);
  const retryCap = Math.max(retryBase, graphRetryCapMs);
  const cache = new Map<string, { ts: number; items: SchedItem[] }>();
  const inflight = new Map<string, { controller: AbortController; promise: Promise<SchedItem[]> }>();
  const sleep = (ms: number) =>
    ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

  const parseRetryAfter = (value: string | null): number | null => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    const seconds = Number(trimmed);
    if (Number.isFinite(seconds)) {
      return Math.max(0, seconds * 1000);
    }
    const absolute = Date.parse(trimmed);
    if (!Number.isNaN(absolute)) {
      const delta = absolute - Date.now();
      return delta > 0 ? delta : 0;
    }
    return null;
  };

  const computeDelay = (attempt: number, retryAfter: string | null): number => {
    const headerDelay = parseRetryAfter(retryAfter);
    if (headerDelay !== null) {
      const baseline = retryBase > 0 ? retryBase : 0;
      const desired = headerDelay < baseline ? baseline : headerDelay;
      return retryCap > 0 ? Math.min(retryCap, desired) : desired;
    }
    if (retryBase <= 0) {
      return 0;
    }
    const backoff = retryBase * Math.pow(2, attempt);
    return retryCap > 0 ? Math.min(retryCap, backoff) : backoff;
  };

  const readRetryAfter = (response: Response): string | null => {
    const candidate = (response as { headers?: { get?: (name: string) => string | null } }).headers;
    if (candidate && typeof candidate.get === 'function') {
      try {
        return candidate.get('retry-after');
      } catch {
        return null;
      }
    }
    return null;
  };

  const createImpl = options?.create ?? (async () => {
    throw new Error('Schedules create is not configured for Graph adapter. Provide a create handler.');
  });

  return {
    async list(range) {
      const key = `${range.from}_${range.to}`;
      const cached = cache.get(key);
      if (cached && Date.now() - cached.ts < cacheTtlMs) {
        return cached.items;
      }

      const existing = inflight.get(key);
      if (existing) {
        return existing.promise;
      }

      // cancel any in-flight requests for other ranges to keep the latest interaction snappy
      for (const [otherKey, entry] of inflight) {
        if (otherKey !== key) {
          entry.controller.abort();
          inflight.delete(otherKey);
        }
      }

      const controller = new AbortController();
      const promise = (async () => {
        try {
          const token = await getToken();
          if (!token) {
            throw withUserMessage(
              toSafeError(new Error('Graph token not available')),
              'Microsoft 連携の権限が必要です。サインインをやり直してください。',
            );
          }

          const params = new URLSearchParams({
            startDateTime: range.from,
            endDateTime: range.to,
            $top: '200',
            $orderby: 'start/dateTime',
          });

          const url = `https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`;
          const headers = {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            Prefer: `outlook.timezone="${timezone}"`,
          } as const;

          let attempt = 0;
          let payload: { value?: GraphEvent[] } = {};

          while (attempt <= retryMax) {
            let response: Response;
            try {
              response = await fetch(url, { headers, signal: controller.signal });
            } catch (error) {
              if (controller.signal.aborted) {
                throw new DOMException('Aborted', 'AbortError');
              }
              throw withUserMessage(
                toSafeError(error instanceof Error ? error : new Error(String(error))),
                '予定の取得に失敗しました。時間をおいて再試行してください。',
              );
            }

            if (response.ok) {
              payload = (await response.json().catch(() => ({}))) as { value?: GraphEvent[] };
              break;
            }

            if (controller.signal.aborted) {
              throw new DOMException('Aborted', 'AbortError');
            }

            const status = response.status;
            const retryableStatus = status === 429 || (status >= 500 && status < 600);

            if (!retryableStatus || attempt === retryMax) {
              const details = await response.text().catch(() => '');
              throw withUserMessage(
                toSafeError(new Error(`Graph error ${status}: ${details.slice(0, 200)}`)),
                '予定の取得に失敗しました。時間をおいて再試行してください。',
              );
            }

            const delay = computeDelay(attempt, readRetryAfter(response));
            attempt += 1;
            if (delay > 0) {
              await sleep(delay);
            }
          }

          const events = Array.isArray(payload.value) ? payload.value : [];
          const items = events
            .map((event) => mapGraphEventToItem(event))
            .filter((item): item is SchedItem => Boolean(item));

          cache.set(key, { ts: Date.now(), items });
          return items;
        } finally {
          inflight.delete(key);
        }
      })();

      inflight.set(key, { controller, promise });
      return promise;
    },
    create: (input) => createImpl(input),
    async remove(_eventId: string): Promise<void> {
      throw new Error('Graph adapter does not support schedule deletion');
    },
  } satisfies SchedulesPort;
};

/**
 * Fetch the list of group IDs the current user is a member of.
 * Used for authorization checks (reception, admin roles).
 */
export const fetchMyGroupIds = async (getToken: GetToken): Promise<string[]> => {
  const token = await getToken();
  if (!token) return [];

  const res = await fetch('https://graph.microsoft.com/v1.0/me/memberOf?$select=id', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`memberOf failed: ${res.status}`);
  }

  const json = await res.json();
  return (json.value ?? []).map((v: { id?: string }) => v.id).filter(Boolean);
};
