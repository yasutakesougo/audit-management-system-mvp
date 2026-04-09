import type { NavAudience } from '@/app/config/navigationConfig.types';
import type { Role } from '@/auth/roles';
import { getDb, isFirestoreWriteAvailable } from '@/infra/firestore/client';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

export const PLANNING_NAV_TELEMETRY_EVENTS = {
  VISIBILITY_CHANGED: 'planning_nav_visibility_changed',
  PAGE_ARRIVED: 'planning_nav_page_arrived',
  SETTINGS_TOGGLED: 'planning_nav_settings_toggled',
  INITIAL_EXPOSED: 'planning_nav_initial_exposed',
  RETAINED_AFTER_INITIAL: 'planning_nav_retained_after_initial',
} as const;

export type PlanningNavTelemetryEventName =
  (typeof PLANNING_NAV_TELEMETRY_EVENTS)[keyof typeof PLANNING_NAV_TELEMETRY_EVENTS];

type PlanningNavTelemetryTrigger =
  | 'init'
  | 'state_change'
  | 'initial_load'
  | 'route_change'
  | 'user_toggle';

type PlanningNavTelemetrySource = 'appshell' | 'settings';

export type PlanningNavTelemetryEvent = {
  eventName: PlanningNavTelemetryEventName;
  role: Role | 'unknown';
  navAudience?: NavAudience;
  mode?: 'normal' | 'focus' | 'kiosk';
  pathname?: string;
  search?: string;
  targetPath?: string;
  fromPath?: string;
  visible?: boolean;
  action?: 'show' | 'hide';
  source?: PlanningNavTelemetrySource;
  trigger?: PlanningNavTelemetryTrigger;
  hiddenBySetting?: boolean;
  hiddenByKiosk?: boolean;
  firstVisibleAt?: string;
  daysSinceFirstVisible?: number;
  retentionWindowDays?: number;
};

export const PLANNING_NAV_STORAGE_KEYS = {
  FIRST_VISIBLE_AT_MS: 'audit:planning-nav:first-visible-at-ms:v1',
  RETENTION_EMITTED: 'audit:planning-nav:retention-emitted:v1',
} as const;

const DEFAULT_RETENTION_DAYS = 7;

const readNumberFromStorage = (key: string): number | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const readBooleanFromStorage = (key: string): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

const writeToStorage = (key: string, value: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // localStorage unavailable: silently ignore telemetry state persistence
  }
};

/**
 * Fire-and-forget telemetry for Planning navigation exposure/usage.
 * Failure is intentionally swallowed to avoid blocking UI interactions.
 */
export function recordPlanningNavTelemetry(event: PlanningNavTelemetryEvent): void {
  if (!isFirestoreWriteAvailable()) {
    return;
  }

  const payload = {
    ...event,
    event: event.eventName,
    type: 'planning_nav_telemetry' as const,
    ts: serverTimestamp(),
    clientTs: new Date().toISOString(),
  };

  try {
    addDoc(collection(getDb(), 'telemetry'), payload).catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('[planning-nav:telemetry] write failed', err);
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[planning-nav:telemetry] skipped (db not ready)', err);
  }
}

type PlanningNavContext = Pick<
  PlanningNavTelemetryEvent,
  'role' | 'navAudience' | 'mode' | 'pathname' | 'search'
>;

/**
 * Marks the first time the Planning group is effectively visible.
 * Idempotent per browser profile.
 */
export function markPlanningNavInitialExposure(
  context: PlanningNavContext,
  nowMs: number = Date.now(),
): void {
  const existing = readNumberFromStorage(PLANNING_NAV_STORAGE_KEYS.FIRST_VISIBLE_AT_MS);
  if (existing !== null) return;

  writeToStorage(PLANNING_NAV_STORAGE_KEYS.FIRST_VISIBLE_AT_MS, String(nowMs));
  recordPlanningNavTelemetry({
    eventName: PLANNING_NAV_TELEMETRY_EVENTS.INITIAL_EXPOSED,
    ...context,
    visible: true,
    source: 'appshell',
    trigger: 'init',
    firstVisibleAt: new Date(nowMs).toISOString(),
  });
}

/**
 * Emits retention event once when Planning remains visible after the configured window.
 */
export function maybeRecordPlanningNavRetention(
  context: PlanningNavContext,
  opts: { nowMs?: number; retentionWindowDays?: number } = {},
): void {
  const firstVisibleAtMs = readNumberFromStorage(PLANNING_NAV_STORAGE_KEYS.FIRST_VISIBLE_AT_MS);
  if (firstVisibleAtMs === null) return;
  if (readBooleanFromStorage(PLANNING_NAV_STORAGE_KEYS.RETENTION_EMITTED)) return;

  const nowMs = opts.nowMs ?? Date.now();
  const retentionWindowDays = opts.retentionWindowDays ?? DEFAULT_RETENTION_DAYS;
  const windowMs = retentionWindowDays * 24 * 60 * 60 * 1000;
  const elapsedMs = nowMs - firstVisibleAtMs;
  if (elapsedMs < windowMs) return;

  const daysSinceFirstVisible = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  writeToStorage(PLANNING_NAV_STORAGE_KEYS.RETENTION_EMITTED, '1');
  recordPlanningNavTelemetry({
    eventName: PLANNING_NAV_TELEMETRY_EVENTS.RETAINED_AFTER_INITIAL,
    ...context,
    visible: true,
    source: 'appshell',
    trigger: 'state_change',
    firstVisibleAt: new Date(firstVisibleAtMs).toISOString(),
    daysSinceFirstVisible,
    retentionWindowDays,
  });
}

