import { HealthCheckResult, HealthStatus } from "../types";

// statusRank is retained for potential future worst-of aggregation.
export const statusRank: Record<HealthStatus, number> = { pass: 0, warn: 1, fail: 2 };

export function pass(
  base: Omit<HealthCheckResult, "status" | "nextActions"> & {
    nextActions?: HealthCheckResult["nextActions"];
  }
): HealthCheckResult {
  return { ...base, status: "pass", nextActions: base.nextActions ?? [] };
}

export function warn(
  base: Omit<HealthCheckResult, "status" | "nextActions"> & {
    nextActions?: HealthCheckResult["nextActions"];
  }
): HealthCheckResult {
  return { ...base, status: "warn", nextActions: base.nextActions ?? [] };
}

export function fail(
  base: Omit<HealthCheckResult, "status" | "nextActions"> & {
    nextActions?: HealthCheckResult["nextActions"];
  }
): HealthCheckResult {
  return { ...base, status: "fail", nextActions: base.nextActions ?? [] };
}

export function stringifyErr(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

export function extractHttpStatus(e: unknown): number | undefined {
  if (typeof e === "object" && e !== null && "status" in e) {
    const status = (e as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  if (e instanceof Error) {
    const m = e.message.match(/\b(\d{3})\b/);
    if (m) return Number(m[1]);
  }
  return undefined;
}

export const TRANSIENT_PERMISSION_STATUSES = new Set([429, 500, 502, 503, 504]);
export const TRANSIENT_UPDATE_RETRY_STATUSES = new Set([429, 503]);
const IS_VITEST = typeof process !== "undefined" && process.env?.VITEST === "true";

export function isTransientPermissionStatus(status: number | undefined): boolean {
  return typeof status === "number" && TRANSIENT_PERMISSION_STATUSES.has(status);
}

export function isRetryableUpdateStatus(status: number | undefined): boolean {
  return typeof status === "number" && TRANSIENT_UPDATE_RETRY_STATUSES.has(status);
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function summarizeHttpStatus(status: number | undefined): string {
  return typeof status === "number" ? `HTTP ${status}` : "HTTP status unknown";
}

export function hasPlaceholder(v: unknown): boolean {
  const s = String(v ?? "");
  return (
    s.includes("<yourtenant>") ||
    s.includes("<yoursite>") ||
    s.includes("yourtenant") ||
    s.includes("yoursite")
  );
}

export function pickEnvKeys(env: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = env[k];
  return out;
}

export function isEnabled(v: unknown): boolean {
  const normalized = String(v ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export type SafeResult<T> = { ok: true; v: T } | { ok: false; err: string; status?: number };

export async function safe<T>(
  fn: () => Promise<T>
): Promise<SafeResult<T>> {
  try {
    return { ok: true, v: await fn() };
  } catch (e) {
    return { ok: false, err: stringifyErr(e), status: extractHttpStatus(e) };
  }
}

export async function safeWithRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    baseDelayMs: number;
    jitterMs: number;
  },
  shouldRetry: (status: number | undefined) => boolean = isRetryableUpdateStatus,
): Promise<(SafeResult<T> & { attempts: number })> {
  const maxAttempts = options.maxRetries + 1;
  for (let attempts = 1; attempts <= maxAttempts; attempts += 1) {
    const result = await safe(fn);
    if (result.ok) {
      return { ...result, attempts };
    }
    if (!shouldRetry(result.status) || attempts >= maxAttempts) {
      return { ...result, attempts };
    }
    const jitter = options.jitterMs > 0 ? Math.floor(Math.random() * options.jitterMs) : 0;
    const delayMs = IS_VITEST ? 0 : options.baseDelayMs * attempts + jitter;
    await wait(delayMs);
  }
  return { ok: false, err: "retry loop exited unexpectedly", attempts: maxAttempts };
}
