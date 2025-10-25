import { onCLS, onFID, onINP, onLCP, onTTFB } from 'web-vitals';
import { isDev } from './env';

type Metric = {
  name: string;
  value: number;
  id: string;
  delta: number;
  entries: PerformanceEntry[];
};

// Keep a compact in-memory log (cap to avoid unbounded growth)
const entries: Array<Pick<Metric, 'name' | 'value' | 'id' | 'delta'>> = [];

const isCI = typeof process !== 'undefined' && process.env?.CI === 'true';
const isBrowser = typeof window !== 'undefined';

// Debounced persist for CI/SSR only
let persistTimer: ReturnType<typeof setTimeout> | null = null;
const persistEntries = () => {
  if (!isCI || isBrowser) return; // Only write from CI in non-browser contexts (SSR, node)
  void import('node:fs')
    .then((fsModule) => {
      const fs = (fsModule as unknown as { default?: typeof import('fs'); writeFileSync: typeof import('fs').writeFileSync }).default ?? (fsModule as unknown as typeof import('fs'));
      const payload = JSON.stringify({ entries }, null, 2);
      fs.writeFileSync('web-vitals.json', payload);
    })
    .catch(() => {
      // ignore file system issues in CI SSR contexts
    });
};
const schedulePersist = () => {
  if (!isCI || isBrowser) return;
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistEntries();
  }, 100);
};

// Optional browser reporting endpoint via runtime env (set in window.__ENV__)
const getBrowserEndpoint = (): string | null => {
  if (!isBrowser) return null;
  const anyWin = window as unknown as { __ENV__?: Record<string, unknown> };
  const endpoint = (anyWin.__ENV__?.WEB_VITALS_ENDPOINT as string) || '';
  return endpoint || null;
};

const safeBeacon = (url: string, body: unknown) => {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
      navigator.sendBeacon(url, blob);
    }
  } catch {
    // ignore beacon errors
  }
};

const handleMetric = (metric: Metric) => {
  // store compact form
  entries.push({ name: metric.name, value: metric.value, id: metric.id, delta: metric.delta });
  if (entries.length > 200) entries.splice(0, entries.length - 200);

  // Dev-friendly console output only in dev or when explicitly enabled
  if (isDev || (typeof process !== 'undefined' && process.env?.DEBUG_WEB_VITALS === '1')) {
    // eslint-disable-next-line no-console
    console.log('[web-vitals]', metric.name, metric.value, metric.id, { delta: metric.delta });
  }

  // In CI SSR, persist to file (debounced)
  schedulePersist();

  // In browsers, optionally report to an endpoint if configured
  const endpoint = getBrowserEndpoint();
  if (endpoint) {
    safeBeacon(endpoint, {
      name: metric.name,
      value: metric.value,
      id: metric.id,
      delta: metric.delta,
      ts: Date.now(),
    });
  }

  // Expose latest metric for quick ad‑hoc debugging in non‑prod
  if (isBrowser && isDev) {
    (window as unknown as { __WEB_VITALS__?: unknown[] }).__WEB_VITALS__ ??= [];
    (window as unknown as { __WEB_VITALS__?: unknown[] }).__WEB_VITALS__!.push(metric);
  }
};

// Register listeners immediately on module load (side‑effect module)
[onLCP, onINP, onFID, onTTFB, onCLS].forEach((register) => register(handleMetric));

// Named export for tests (optional usage)
export const __getWebVitalsLog = () => entries.slice();
