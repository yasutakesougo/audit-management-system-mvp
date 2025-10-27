type HydrationSpanMeta = Record<string, unknown>;

type HydrationSpanCompletion = {
  meta?: HydrationSpanMeta;
  error?: string;
};

type HydrationSpanOptions = {
  id?: string;
  label?: string;
  group?: string;
  meta?: HydrationSpanMeta;
};

export type HydrationSpan = {
  id: string;
  label: string;
  group?: string;
  start: number;
  end?: number;
  duration?: number;
  meta?: HydrationSpanMeta;
  error?: string;
};

const pending = new Map<string, HydrationSpan>();
const store = new Map<string, HydrationSpan>();
const subscribers = new Set<(spans: HydrationSpan[]) => void>();

const TRUTHY = new Set(['1', 'true', 'yes', 'y', 'on', 'enabled']);

const now = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }
  return Date.now();
};

const sortSpans = (input: Iterable<HydrationSpan>): HydrationSpan[] => {
  const list = Array.from(input);
  list.sort((a, b) => a.start - b.start);
  return list;
};

const publish = (): void => {
  const snapshot = sortSpans(store.values());
  if (typeof window !== 'undefined') {
    const target = window as Window & { __HYDRATION_HUD__?: Record<string, unknown> };
    if (!target.__HYDRATION_HUD__) {
      target.__HYDRATION_HUD__ = {};
    }
    target.__HYDRATION_HUD__.spans = snapshot;
  }
  subscribers.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      // ignore subscribers that throw
    }
  });
};

const mergeMeta = (base?: HydrationSpanMeta, next?: HydrationSpanMeta): HydrationSpanMeta | undefined => {
  if (!base && !next) return undefined;
  if (!base) return { ...next };
  if (!next) return { ...base };
  return { ...base, ...next };
};


const normalizeError = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const toSnapshot = (): HydrationSpan[] => sortSpans(store.values());

const completeInternal = (span: HydrationSpan, completion?: HydrationSpanCompletion): HydrationSpan => {
  const end = now();
  const finalized: HydrationSpan = {
    ...span,
    end,
    duration: Math.max(0, end - span.start),
    meta: mergeMeta(span.meta, completion?.meta),
    error: completion?.error ?? span.error,
  };
  pending.delete(span.id);
  store.set(span.id, finalized);
  publish();
  return finalized;
};

export const beginHydrationSpan = (
  label: string,
  options: HydrationSpanOptions = {}
): ((completion?: HydrationSpanCompletion) => HydrationSpan) => {
  const id = options.id ?? label;
  const existing = pending.get(id);
  if (existing) {
    return (completion) => completeInternal(existing, completion);
  }
  const start = now();
  const span: HydrationSpan = {
    id,
    label: options.label ?? label,
    group: options.group,
    start,
    meta: options.meta ? { ...options.meta } : undefined,
  };
  pending.set(id, span);
  store.set(id, span);
  publish();
  return (completion) => completeInternal(span, completion);
};

export const completeHydrationSpan = (id: string, completion?: HydrationSpanCompletion): HydrationSpan => {
  const span = pending.get(id) ?? store.get(id);
  if (!span) {
    const synthetic: HydrationSpan = {
      id,
      label: id,
      start: now(),
    };
    return completeInternal(synthetic, completion);
  }
  return completeInternal(span, completion);
};

export const getHydrationSpans = (): HydrationSpan[] => toSnapshot();

export const subscribeHydrationSpans = (
  listener: (spans: HydrationSpan[]) => void
): (() => void) => {
  subscribers.add(listener);
  listener(toSnapshot());
  return () => {
    subscribers.delete(listener);
  };
};

export const resetHydrationSpans = (): void => {
  pending.clear();
  store.clear();
  publish();
};

export const updateHydrationSpanMeta = (id: string, meta: HydrationSpanMeta): void => {
  const span = pending.get(id) ?? store.get(id);
  if (!span) return;
  span.meta = mergeMeta(span.meta, meta);
  store.set(id, span);
  publish();
};

export const finalizeHydrationSpan = (
  complete: ((completion?: HydrationSpanCompletion) => HydrationSpan) | null | undefined,
  error?: unknown,
  meta?: HydrationSpanMeta
): void => {
  if (!complete) return;
  if (error) {
    complete({ meta, error: normalizeError(error) });
    return;
  }
  complete({ meta });
};

export const isHudExplicitlyEnabled = (): boolean => {
  if (typeof process !== 'undefined' && process.env && process.env.PREFETCH_HUD) {
    return TRUTHY.has(process.env.PREFETCH_HUD.trim().toLowerCase());
  }
  if (typeof window !== 'undefined') {
    const runtime = (window as Window & { __ENV__?: Record<string, string | undefined> }).__ENV__;
    const candidate = runtime?.VITE_PREFETCH_HUD ?? runtime?.VITE_ENABLE_HUD;
    if (candidate && TRUTHY.has(candidate.trim().toLowerCase())) {
      return true;
    }
  }
  const inline = (import.meta as ImportMeta).env ?? {};
  const candidate = (inline as Record<string, string | undefined>).VITE_PREFETCH_HUD ??
    (inline as Record<string, string | undefined>).VITE_ENABLE_HUD;
  if (candidate && TRUTHY.has(candidate.trim().toLowerCase())) {
    return true;
  }
  return false;
};