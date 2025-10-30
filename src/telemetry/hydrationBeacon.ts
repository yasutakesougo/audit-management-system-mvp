import type { HydrationSpan } from '@/lib/hydrationHud';

export type HydrationTelemetrySpan = {
  key: string;
  dur: number;
  status: 'completed' | 'error' | 'superseded';
  meta?: Record<string, unknown>;
};

type EnvRecord = Record<string, string | undefined>;

type SendDependencies = {
  now?: () => number;
  rand?: () => number;
};

const FALLBACK_ENDPOINT = '/__telemetry__';

const readInlineEnv = (): EnvRecord => {
  const meta = (import.meta as ImportMeta | undefined);
  const env = meta?.env;
  if (env && typeof env === 'object') {
    return env as EnvRecord;
  }
  return {};
};

const readWindowEnv = (): EnvRecord => {
  if (typeof window === 'undefined') {
    return {};
  }
  const candidate = (window as Window & { __ENV__?: EnvRecord }).__ENV__;
  if (candidate && typeof candidate === 'object') {
    return candidate;
  }
  return {};
};

const resolveEnv = (): EnvRecord => ({
  ...readInlineEnv(),
  ...readWindowEnv(),
});

export const getTelemetryEndpoint = (): string => {
  const env = resolveEnv();
  const value = env.VITE_TELEMETRY_URL;
  return value && value.trim().length ? value : FALLBACK_ENDPOINT;
};

export const getTelemetrySampleRate = (): number => {
  const env = resolveEnv();
  const raw = env.VITE_TELEMETRY_SAMPLE ?? '1';
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed)) {
    return 1;
  }
  if (parsed < 0) {
    return 0;
  }
  if (parsed > 1) {
    return 1;
  }
  return parsed;
};

const toTelemetrySpan = (span: HydrationSpan): HydrationTelemetrySpan | null => {
  if (span.end === undefined) {
    return null;
  }
  const duration = Number.isFinite(span.duration) ? Number(span.duration) : 0;
  const metaStatus = span.meta && typeof span.meta === 'object' && 'status' in span.meta
    ? String((span.meta as Record<string, unknown>).status)
    : '';
  let status: HydrationTelemetrySpan['status'] = 'completed';
  if (span.error) {
    status = 'error';
  } else if (metaStatus === 'superseded') {
    status = 'superseded';
  }
  const meta = span.meta && typeof span.meta === 'object' && Object.keys(span.meta).length > 0
    ? { ...span.meta }
    : undefined;
  return {
    key: span.id,
    dur: duration > 0 ? duration : 0,
    status,
    meta,
  };
};

const toPayload = (spans: (HydrationSpan | HydrationTelemetrySpan)[]): HydrationTelemetrySpan[] =>
  spans
    .map((span) => {
      if ('dur' in span) {
        return span as HydrationTelemetrySpan;
      }
      return toTelemetrySpan(span as HydrationSpan);
    })
    .filter((value): value is HydrationTelemetrySpan => Boolean(value));

export function sendHydrationSpans(
  spans: (HydrationSpan | HydrationTelemetrySpan)[],
  dependencies: SendDependencies = {}
): boolean {
  const payload = toPayload(spans);
  if (payload.length === 0) {
    return false;
  }
  const { now = Date.now, rand = Math.random } = dependencies;
  const sample = getTelemetrySampleRate();
  if (sample <= 0) {
    return false;
  }
  if (sample < 1 && rand() > sample) {
    return false;
  }

  const endpoint = getTelemetryEndpoint();
  const body = JSON.stringify({
    t: now(),
    app: 'ams',
    spans: payload,
  });

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const sent = navigator.sendBeacon(endpoint, new Blob([body], { type: 'application/json' }));
      if (sent) {
        return true;
      }
    }
  } catch {
    // swallow sendBeacon errors and try fetch fallback
  }

  if (typeof fetch === 'function') {
    fetch(endpoint, {
      method: 'POST',
      body,
      headers: { 'content-type': 'application/json' },
      keepalive: true,
    }).catch(() => {
      // ignore network failures
    });
    return true;
  }

  return false;
}

export { toTelemetrySpan };
