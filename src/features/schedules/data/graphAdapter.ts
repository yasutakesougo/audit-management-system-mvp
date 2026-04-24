import { readOptionalEnv, getAppConfig } from '@/lib/env';
import { toSafeError } from '@/lib/errors';
import { withUserMessage } from '@/lib/notice';
import { createGraphClient, GraphAuthError, GraphApiError, type GetToken } from '@/lib/graph/graphFetch';
import type { Event as GraphEvent } from '@microsoft/microsoft-graph-types';
import type { SchedItem, SchedulesPort } from './port';
import { result } from '@/shared/result';

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
    undefined;

  const id = fallbackId(event);
  const etagValue = (event as { __metadata?: { id?: string } })?.__metadata?.id || `"graph-${id}"`;

  return {
    id,
    title: normalizeTitle(event.subject ?? undefined),
    start,
    end,
    assignedTo: assignedTo ? assignedTo.toLowerCase() : undefined,
    etag: etagValue,
  };
};

const isAbortError = (e: unknown): e is DOMException =>
  e instanceof DOMException && e.name === 'AbortError';

export const makeGraphSchedulesPort = (getToken: GetToken, options?: GraphSchedulesPortOptions): SchedulesPort => {
  const timezone = resolveTimezone();
  const { schedulesCacheTtlSec } = getAppConfig();
  const cacheTtlMs = Math.max(0, schedulesCacheTtlSec) * 1000;
  const cache = new Map<string, { ts: number; items: SchedItem[] }>();
  const inflight = new Map<string, { controller: AbortController; promise: Promise<SchedItem[]> }>();

  const graphClient = createGraphClient(getToken);

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
          const params = new URLSearchParams({
            startDateTime: range.from,
            endDateTime: range.to,
            $top: '200',
            $orderby: 'start/dateTime',
          });

          const path = `/me/calendarView?${params.toString()}`;

          let payload: { value?: GraphEvent[] };
          try {
            payload = await graphClient.fetchJson<{ value?: GraphEvent[] }>(path, {
              headers: { Prefer: `outlook.timezone="${timezone}"` },
              signal: controller.signal,
            });
          } catch (error) {
            if (isAbortError(error)) {
              throw new DOMException('Aborted', 'AbortError');
            }
            if (error instanceof GraphAuthError) {
              throw withUserMessage(
                toSafeError(error),
                'Microsoft 連携の権限が必要です。サインインをやり直してください。',
              );
            }
            if (error instanceof GraphApiError) {
              throw withUserMessage(
                toSafeError(error),
                '予定の取得に失敗しました。時間をおいて再試行してください。',
              );
            }
            throw withUserMessage(
              toSafeError(error instanceof Error ? error : new Error(String(error))),
              '予定の取得に失敗しました。時間をおいて再試行してください。',
            );
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
    create: (input) => {
      if (!createImpl) {
        return Promise.resolve(result.err<SchedItem>({
          kind: 'unknown',
          message: 'Graph schedule creation not configured',
        }));
      }
      return createImpl(input).catch((err) => {
        const safeErr = err instanceof Error ? err : new Error(String(err));
        return result.unknown<SchedItem>(safeErr.message, err);
      });
    },
    async remove(_eventId: string): Promise<void> {
      throw new Error('Graph adapter does not support schedule deletion');
    },
  } satisfies SchedulesPort;
};

/**
 * Fetch the list of group IDs the current user is a member of.
 * Used for authorization checks (reception, admin roles).
 *
 * @deprecated Use `import { fetchMyGroupIds } from '@/auth/fetchMyGroupIds'` instead.
 * This re-export exists only for backward compatibility.
 */
export { fetchMyGroupIds } from '@/auth/fetchMyGroupIds';
