import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PLANNING_NAV_STORAGE_KEYS,
  PLANNING_NAV_TELEMETRY_EVENTS,
  markPlanningNavInitialExposure,
  maybeRecordPlanningNavRetention,
  recordPlanningNavTelemetry,
  type PlanningNavTelemetryEvent,
} from '../planningNavTelemetry';

const mockAddDoc = vi.fn().mockResolvedValue({ id: 'planning-nav-event-id' });
const mockCollection = vi.fn().mockReturnValue('mock-collection-ref');
let firestoreWriteAvailable = true;

vi.mock('firebase/firestore', () => ({
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  collection: (...args: unknown[]) => mockCollection(...args),
  serverTimestamp: () => 'mock-server-timestamp',
}));

vi.mock('@/infra/firestore/client', () => ({
  getDb: () => 'mock-db',
  isFirestoreWriteAvailable: () => firestoreWriteAvailable,
}));

describe('planningNavTelemetry', () => {
  beforeEach(() => {
    firestoreWriteAvailable = true;
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('records planning navigation telemetry payload', () => {
    const event: PlanningNavTelemetryEvent = {
      eventName: PLANNING_NAV_TELEMETRY_EVENTS.VISIBILITY_CHANGED,
      role: 'admin',
      navAudience: 'admin',
      mode: 'normal',
      pathname: '/today',
      visible: true,
      source: 'appshell',
      trigger: 'state_change',
    };

    recordPlanningNavTelemetry(event);

    expect(mockCollection).toHaveBeenCalledWith('mock-db', 'telemetry');
    expect(mockAddDoc).toHaveBeenCalledWith(
      'mock-collection-ref',
      expect.objectContaining({
        type: 'planning_nav_telemetry',
        event: PLANNING_NAV_TELEMETRY_EVENTS.VISIBILITY_CHANGED,
        eventName: PLANNING_NAV_TELEMETRY_EVENTS.VISIBILITY_CHANGED,
        role: 'admin',
        navAudience: 'admin',
        visible: true,
        ts: 'mock-server-timestamp',
      }),
    );
  });

  it('is no-op when Firestore write is unavailable', () => {
    firestoreWriteAvailable = false;
    recordPlanningNavTelemetry({
      eventName: PLANNING_NAV_TELEMETRY_EVENTS.PAGE_ARRIVED,
      role: 'viewer',
      pathname: '/planning-sheet-list',
      source: 'appshell',
      trigger: 'route_change',
    });
    expect(mockCollection).not.toHaveBeenCalled();
    expect(mockAddDoc).not.toHaveBeenCalled();
  });

  it('marks initial exposure only once', () => {
    const now = Date.parse('2026-04-09T00:00:00.000Z');
    markPlanningNavInitialExposure(
      {
        role: 'viewer',
        navAudience: 'staff',
        mode: 'normal',
        pathname: '/today',
        search: '',
      },
      now,
    );
    markPlanningNavInitialExposure(
      {
        role: 'viewer',
        navAudience: 'staff',
        mode: 'normal',
        pathname: '/today',
        search: '',
      },
      now + 1_000,
    );

    expect(localStorage.getItem(PLANNING_NAV_STORAGE_KEYS.FIRST_VISIBLE_AT_MS)).toBe(String(now));
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    expect(mockAddDoc).toHaveBeenCalledWith(
      'mock-collection-ref',
      expect.objectContaining({
        event: PLANNING_NAV_TELEMETRY_EVENTS.INITIAL_EXPOSED,
      }),
    );
  });

  it('emits retention event once after the retention window', () => {
    const firstVisibleAt = Date.parse('2026-04-01T00:00:00.000Z');
    const now = Date.parse('2026-04-10T00:00:00.000Z');
    localStorage.setItem(
      PLANNING_NAV_STORAGE_KEYS.FIRST_VISIBLE_AT_MS,
      String(firstVisibleAt),
    );

    maybeRecordPlanningNavRetention(
      {
        role: 'viewer',
        navAudience: 'staff',
        mode: 'normal',
        pathname: '/planning-sheet-list',
        search: '',
      },
      { nowMs: now, retentionWindowDays: 7 },
    );
    maybeRecordPlanningNavRetention(
      {
        role: 'viewer',
        navAudience: 'staff',
        mode: 'normal',
        pathname: '/planning-sheet-list',
        search: '',
      },
      { nowMs: now + 24 * 60 * 60 * 1000, retentionWindowDays: 7 },
    );

    expect(localStorage.getItem(PLANNING_NAV_STORAGE_KEYS.RETENTION_EMITTED)).toBe('1');
    expect(mockAddDoc).toHaveBeenCalledTimes(1);
    expect(mockAddDoc).toHaveBeenCalledWith(
      'mock-collection-ref',
      expect.objectContaining({
        event: PLANNING_NAV_TELEMETRY_EVENTS.RETAINED_AFTER_INITIAL,
        retentionWindowDays: 7,
      }),
    );
  });

  it('does not emit retention event before the retention window', () => {
    const firstVisibleAt = Date.parse('2026-04-08T00:00:00.000Z');
    const now = Date.parse('2026-04-10T00:00:00.000Z');
    localStorage.setItem(
      PLANNING_NAV_STORAGE_KEYS.FIRST_VISIBLE_AT_MS,
      String(firstVisibleAt),
    );

    maybeRecordPlanningNavRetention(
      {
        role: 'viewer',
        navAudience: 'staff',
        mode: 'normal',
        pathname: '/planning-sheet-list',
        search: '',
      },
      { nowMs: now, retentionWindowDays: 7 },
    );

    expect(localStorage.getItem(PLANNING_NAV_STORAGE_KEYS.RETENTION_EMITTED)).toBeNull();
    expect(mockAddDoc).not.toHaveBeenCalled();
  });
});
