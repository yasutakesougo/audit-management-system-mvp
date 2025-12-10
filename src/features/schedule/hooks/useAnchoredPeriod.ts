import { HYDRATION_FEATURES, estimatePayloadSize, startFeatureSpan } from '@/hydration/features';
import dayjs, { type Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const PARAM_FMT = 'YYYY-MM-DD';
const URL_WRITE_GUARD_MS = 30_000;
const URL_ADOPT_LOCK_MS = 5_000;

export type PeriodKind = 'week' | 'day';

export function startOf(kind: PeriodKind, d = dayjs()): Dayjs {
  return kind === 'week' ? d.startOf('week').add(1, 'day') : d.startOf('day');
}

export function endOf(kind: PeriodKind, base: Dayjs): Dayjs {
  return kind === 'week' ? base.endOf('week') : base.endOf('day');
}

export function formatLabel(kind: PeriodKind, anchor: Dayjs): string {
  const from = startOf(kind, anchor);
  const to = endOf(kind, startOf(kind, anchor));
  return kind === 'week'
    ? `${from.format('YYYY/MM/DD')} – ${to.format('YYYY/MM/DD')}`
    : `${from.format('YYYY/MM/DD')}`;
}

export function parseParam(value: string | null, kind: PeriodKind): Dayjs | null {
  if (!value) {
    return null;
  }
  const parsed = dayjs(value, PARAM_FMT, true);
  if (!parsed.isValid()) {
    return null;
  }
  return startOf(kind, parsed);
}

export function fmtParam(value: Dayjs): string {
  return value.format(PARAM_FMT);
}

export function useAnchoredPeriod(kind: PeriodKind) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initial = parseParam(searchParams.get(kind), kind) ?? startOf(kind);
  const [anchor, setAnchor] = useState<Dayjs>(initial);

  const urlWriteGuardRef = useRef<{ until: number; intended: string } | null>(null);
  const urlAdoptLockAtRef = useRef(0);
  const allowExternalRef = useRef(false);
  const skipAnchorSyncRef = useRef(true);
  const lastIntentParamRef = useRef(fmtParam(initial));
  const hasInitialSyncRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const onPopState = () => {
      allowExternalRef.current = true;
    };
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  useEffect(() => {
    const raw = searchParams.get(kind);
    const current = fmtParam(anchor);
    const matchesIntent = raw === lastIntentParamRef.current;

    if (raw === current) {
      hasInitialSyncRef.current = true;
      return;
    }

    if (typeof window !== 'undefined' && Date.now() - urlAdoptLockAtRef.current < URL_ADOPT_LOCK_MS) {
      const scope = window as typeof window & { __anchorParamIgnored__?: string[] };
      scope.__anchorParamIgnored__ = [...(scope.__anchorParamIgnored__ ?? []), raw ?? ''];
      return;
    }

    const guard = urlWriteGuardRef.current;
    const guardActive = guard && Date.now() < guard.until;
    const allowExternal = allowExternalRef.current;
    const shouldAdopt = !hasInitialSyncRef.current || allowExternal || matchesIntent;

    if (!shouldAdopt && raw && raw !== current) {
      const next = new URLSearchParams(searchParams);
      next.set(kind, current);
      urlWriteGuardRef.current = { until: Date.now() + URL_WRITE_GUARD_MS, intended: current };
      setSearchParams(next, { replace: true });
      return;
    }

    if (allowExternal) {
      allowExternalRef.current = false;
      urlWriteGuardRef.current = null;
    }

    if (!raw) {
      hasInitialSyncRef.current = true;
      const next = new URLSearchParams(searchParams);
      next.set(kind, current);
      urlWriteGuardRef.current = { until: Date.now() + URL_WRITE_GUARD_MS, intended: current };
      setSearchParams(next, { replace: true });
      return;
    }

    if (!allowExternal && guardActive && raw !== guard?.intended) {
      const next = new URLSearchParams(searchParams);
      next.set(kind, current);
      urlWriteGuardRef.current = { until: Date.now() + URL_WRITE_GUARD_MS, intended: current };
      setSearchParams(next, { replace: true });
      return;
    }

    const parsed = parseParam(raw, kind);
    if (!parsed) {
      return;
    }

    hasInitialSyncRef.current = true;
    setAnchor((currentAnchor) => (currentAnchor.isSame(parsed, 'day') ? currentAnchor : parsed));
  }, [anchor, kind, searchParams, setSearchParams]);

  useEffect(() => {
    const param = fmtParam(anchor);
    if (skipAnchorSyncRef.current) {
      skipAnchorSyncRef.current = false;
      return;
    }
    if (searchParams.get(kind) === param) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set(kind, param);
    urlAdoptLockAtRef.current = Date.now();
    lastIntentParamRef.current = param;
    urlWriteGuardRef.current = { until: Date.now() + URL_WRITE_GUARD_MS, intended: param };
    setSearchParams(next, { replace: true });

    if (typeof window !== 'undefined') {
      const scope = window as typeof window & { __anchorParamSetLog__?: string[] };
      scope.__anchorParamSetLog__ = [...(scope.__anchorParamSetLog__ ?? []), param];
    }
  }, [anchor, kind, searchParams, setSearchParams]);

  const range = useMemo(() => {
    const span = startFeatureSpan(HYDRATION_FEATURES.schedules.range, {
      kind,
    });
    try {
      const from = startOf(kind, anchor);
      const to = endOf(kind, from);
      const payload = {
        fromISO: from.toDate().toISOString(),
        toISO: to.toDate().toISOString(),
        label: formatLabel(kind, anchor),
        param: fmtParam(anchor),
      };
      span({ meta: { status: 'ok', bytes: estimatePayloadSize(payload) } });
      return payload;
    } catch (error) {
      span({
        meta: { status: 'error' },
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }, [anchor, kind]);

  const navigate = useCallback(
    (direction: -1 | 1) => {
      setAnchor((currentAnchor) =>
        currentAnchor.add(direction, kind === 'week' ? 'week' : 'day'),
      );
    },
    [kind],
  );

  return { anchor, setAnchor, range, navigate };
}
