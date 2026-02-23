import * as React from 'react';

export type AttendanceActionType = 'checkIn' | 'checkOut' | 'markAbsent' | 'clearAbsent';
export type AttendanceErrorCode = 'CONFLICT' | 'THROTTLED' | 'NETWORK' | 'UNKNOWN';

export type AttendanceError = {
  code: AttendanceErrorCode;
  originalError: unknown;
};

export const isAttendanceError = (error: unknown): error is AttendanceError => {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as Record<string, unknown>;
  return typeof candidate.code === 'string' && 'originalError' in candidate;
};

const toRecord = (value: unknown): Record<string, unknown> | null => {
  if (typeof value !== 'object' || value === null) return null;
  return value as Record<string, unknown>;
};

const extractStatus = (error: unknown): number | undefined => {
  const root = toRecord(error);
  if (!root) return undefined;

  const direct = root.status;
  if (typeof direct === 'number') return direct;

  const response = toRecord(root.response);
  if (response && typeof response.status === 'number') return response.status;

  const cause = toRecord(root.cause);
  if (cause && typeof cause.status === 'number') return cause.status;

  const nestedError = toRecord(root.error);
  if (nestedError && typeof nestedError.status === 'number') return nestedError.status;

  const data = toRecord(root.data);
  if (data && typeof data.status === 'number') return data.status;

  return undefined;
};

const isNetworkLike = (error: unknown): boolean => {
  const root = toRecord(error);
  if (!root) return false;

  const message = typeof root.message === 'string' ? root.message : '';
  const name = typeof root.name === 'string' ? root.name : '';
  return (
    name === 'TypeError' ||
    /Failed to fetch/i.test(message) ||
    /NetworkError/i.test(message) ||
    /network/i.test(message)
  );
};

export const classifyAttendanceError = (error: unknown): AttendanceError => {
  const status = extractStatus(error);

  if (status === 412 || status === 409) {
    return { code: 'CONFLICT', originalError: error };
  }

  if (status === 429 || status === 503) {
    return { code: 'THROTTLED', originalError: error };
  }

  if (isNetworkLike(error)) {
    return { code: 'NETWORK', originalError: error };
  }

  return { code: 'UNKNOWN', originalError: error };
};

type UseAttendanceActionsArgs<TVisitMap> = {
  setVisits: React.Dispatch<React.SetStateAction<TVisitMap>>;
  persist: (nextVisits: TVisitMap) => Promise<void>;
  buildNextVisits: (args: {
    prev: TVisitMap;
    userId: string;
    type: AttendanceActionType;
    nowIso: string;
  }) => TVisitMap;
  nowIso?: () => string;
};

export function useAttendanceActions<TVisitMap>({
  setVisits,
  persist,
  buildNextVisits,
  nowIso = () => new Date().toISOString(),
}: UseAttendanceActionsArgs<TVisitMap>) {
  const inFlightRef = React.useRef<Set<string>>(new Set());

  const run = React.useCallback(
    async (userId: string, type: AttendanceActionType) => {
      const key = `${userId}:${type}`;
      if (inFlightRef.current.has(key)) return;
      inFlightRef.current.add(key);

      let snapshot: TVisitMap | null = null;
      let optimisticNext: TVisitMap | null = null;

      setVisits((prev) => {
        snapshot = prev;
        optimisticNext = buildNextVisits({
          prev,
          userId,
          type,
          nowIso: nowIso(),
        });
        return optimisticNext;
      });

      try {
        if (optimisticNext) {
          await persist(optimisticNext);
        }
      } catch (error) {
        if (snapshot) {
          setVisits(snapshot);
        }
        throw classifyAttendanceError(error);
      } finally {
        inFlightRef.current.delete(key);
      }
    },
    [setVisits, persist, buildNextVisits, nowIso],
  );

  const checkIn = React.useCallback((userId: string) => run(userId, 'checkIn'), [run]);
  const checkOut = React.useCallback((userId: string) => run(userId, 'checkOut'), [run]);
  const markAbsent = React.useCallback((userId: string) => run(userId, 'markAbsent'), [run]);
  const clearAbsent = React.useCallback((userId: string) => run(userId, 'clearAbsent'), [run]);

  return {
    checkIn,
    checkOut,
    markAbsent,
    clearAbsent,
  };
}
