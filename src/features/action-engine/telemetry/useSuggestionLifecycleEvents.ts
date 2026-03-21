import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type DocumentData,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/infra/firestore/client';
import {
  resolveSuggestionTelemetryWindow,
  type SuggestionTelemetryRecord,
  type SuggestionTelemetryWindow,
} from './summarizeSuggestionTelemetry';

const SUGGESTION_LIFECYCLE_EVENT_TYPE = 'suggestion_lifecycle_event';
const DEFAULT_MAX_DOCS = 500;

export type UseSuggestionLifecycleEventsOptions = SuggestionTelemetryWindow & {
  enabled?: boolean;
  maxDocs?: number;
};

export type UseSuggestionLifecycleEventsResult = {
  events: SuggestionTelemetryRecord[];
  isLoading: boolean;
  isEmpty: boolean;
  error: Error | null;
  window: {
    from: Date;
    to: Date;
  };
  refetch: () => Promise<void>;
};

function toDate(value: unknown): Date | undefined {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
    return undefined;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const date = (value as Timestamp).toDate();
    if (date instanceof Date && !Number.isNaN(date.getTime())) return date;
  }
  return undefined;
}

function mapLifecycleDoc(data: DocumentData): SuggestionTelemetryRecord | null {
  const event = typeof data.event === 'string' ? data.event : null;
  const sourceScreen =
    typeof data.sourceScreen === 'string' ? data.sourceScreen : null;
  const stableId = typeof data.stableId === 'string' ? data.stableId : null;
  const ruleId = typeof data.ruleId === 'string' ? data.ruleId : null;
  const priority = typeof data.priority === 'string' ? data.priority : null;

  if (!event || !sourceScreen || !stableId || !ruleId || !priority) {
    return null;
  }

  const clientTimestamp =
    typeof data.clientTs === 'string' ? data.clientTs : undefined;
  const serverTimestamp = toDate(data.ts)?.toISOString();
  const timestamp = clientTimestamp ?? serverTimestamp;

  if (!timestamp) return null;

  return {
    event,
    sourceScreen,
    stableId,
    ruleId,
    priority,
    timestamp,
  };
}

/**
 * suggestion_lifecycle_event を取得して、pure 集計に渡せる shape へ整形する。
 */
export function useSuggestionLifecycleEvents(
  options: UseSuggestionLifecycleEventsOptions = {},
): UseSuggestionLifecycleEventsResult {
  const {
    from,
    to,
    now,
    enabled = true,
    maxDocs = DEFAULT_MAX_DOCS,
  } = options;

  const initialNowRef = useRef<Date>(now ?? new Date());
  const nowMs = now ? now.getTime() : initialNowRef.current.getTime();
  const fromMs = from?.getTime();
  const toMs = to?.getTime();

  const resolvedWindow = useMemo(
    () =>
      resolveSuggestionTelemetryWindow({
        from: fromMs !== undefined ? new Date(fromMs) : undefined,
        to: toMs !== undefined ? new Date(toMs) : undefined,
        now: new Date(nowMs),
      }),
    [fromMs, toMs, nowMs],
  );

  const [events, setEvents] = useState<SuggestionTelemetryRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(enabled);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const col = collection(db, 'telemetry');
      const q = query(
        col,
        where('type', '==', SUGGESTION_LIFECYCLE_EVENT_TYPE),
        where('ts', '>=', resolvedWindow.from),
        where('ts', '<=', resolvedWindow.to),
        orderBy('ts', 'desc'),
        limit(maxDocs),
      );

      const snapshot = await getDocs(q);
      const mapped = snapshot.docs
        .map((doc) => mapLifecycleDoc(doc.data()))
        .filter((doc): doc is SuggestionTelemetryRecord => doc !== null);

      setEvents(mapped);
    } catch (err) {
      setEvents([]);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [maxDocs, resolvedWindow]);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    void refetch();
  }, [enabled, refetch]);

  return {
    events,
    isLoading,
    isEmpty: !isLoading && events.length === 0 && !error,
    error,
    window: resolvedWindow,
    refetch,
  };
}
