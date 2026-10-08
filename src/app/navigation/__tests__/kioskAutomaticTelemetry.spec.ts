import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recordPlanningNavTelemetry, markPlanningNavInitialExposure, maybeRecordPlanningNavRetention, PLANNING_NAV_STORAGE_KEYS } from '../planningNavTelemetry';
import { recordHubTelemetry } from '@/app/hubs/hubTelemetry';
import { recordLanding } from '@/features/today/telemetry/recordLanding';
import { recordPhaseEvent } from '@/features/operationFlow/telemetry/recordPhaseEvent';
import { recordSuggestionTelemetry } from '@/features/action-engine/telemetry/recordSuggestionTelemetry';
import { trackTransportEvent } from '@/features/today/transport/transportTelemetry';
import { recordKioskTelemetry } from '@/features/today/telemetry/recordKioskTelemetry';
import { bindKioskAutomaticTelemetryRouter } from '@/lib/kioskAutomaticTelemetryBoundary';

const firestore = vi.hoisted(() => ({
  addDoc: vi.fn().mockResolvedValue({ id: 'test-event' }),
  collection: vi.fn().mockReturnValue('telemetry-ref'),
  beforeDb: () => {},
}));
vi.mock('firebase/firestore', () => ({ ...firestore, serverTimestamp: () => 'timestamp' }));
vi.mock('@/infra/firestore/client', () => ({ getDb: () => { firestore.beforeDb(); return 'test-db'; }, isFirestoreWriteAvailable: () => true }));

describe('automatic telemetry Kiosk boundary', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); firestore.beforeDb = () => {}; });
  afterEach(() => { window.history.replaceState(null, '', '/'); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('also blocks background, impression, timer and session-start events', () => {
    window.history.replaceState(null, '', '/kiosk');
    recordPhaseEvent({ event: 'phase-suggest-shown', screen: '/today' });
    recordPhaseEvent({ event: 'meeting-mode-suggested' });
    recordPhaseEvent({ event: 'config-load-fallback' });
    recordSuggestionTelemetry({ event: 'suggestion_shown', sourceScreen: 'today', stableId: 'test', ruleId: 'test', priority: 'P1', timestamp: '2026-10-08' });
    trackTransportEvent({ type: 'transport:fallback-all-users', source: 'useTransportStatus', eventVersion: 1, clientTs: '2026-10-08', reason: 'list-not-found', totalUsersShown: 0 });
    recordKioskTelemetry('ux_kiosk_session_started', { source: 'today', mode: 'kiosk' });
    expect(firestore.addDoc).not.toHaveBeenCalled();
  });

  it.each(['/kiosk', '/kiosk/users', '/kiosk/toilet'])('does not persist automatic events at %s', (pathname) => {
    window.history.replaceState(null, '', pathname);
    recordPlanningNavTelemetry({ eventName: 'planning_nav_visibility_changed', role: 'viewer', pathname, trigger: 'init' });
    markPlanningNavInitialExposure({ role: 'viewer', pathname });
    localStorage.setItem(PLANNING_NAV_STORAGE_KEYS.FIRST_VISIBLE_AT_MS, '1');
    maybeRecordPlanningNavRetention({ role: 'viewer', pathname });
    recordHubTelemetry({ eventName: 'hub_viewed', hubId: 'today', role: 'staff', telemetryName: 'hub', pathname });
    recordHubTelemetry({ eventName: 'hub_card_viewed', hubId: 'today', role: 'staff', telemetryName: 'card', pathname });
    recordLanding({ path: pathname, search: '', role: 'staff', referrer: '', userAgent: 'test' });
    expect(firestore.addDoc).not.toHaveBeenCalled();
    expect(firestore.collection).not.toHaveBeenCalled();
  });

  it('preserves non-Kiosk automatic persistence', () => {
    window.history.replaceState(null, '', '/today');
    recordPlanningNavTelemetry({ eventName: 'planning_nav_visibility_changed', role: 'viewer', pathname: '/today', trigger: 'init' });
    recordHubTelemetry({ eventName: 'hub_viewed', hubId: 'today', role: 'staff', telemetryName: 'hub', pathname: '/today' });
    recordLanding({ path: '/today', search: '', role: 'staff', referrer: '', userAgent: 'test' });
    expect(firestore.addDoc).toHaveBeenCalledTimes(3);
  });

  it('does not fall back to fetch or persist an exposure marker when blocked', () => {
    window.history.replaceState(null, '', '/kiosk');
    const fetchFallback = vi.fn();
    vi.stubGlobal('fetch', fetchFallback);
    const persist = vi.spyOn(Storage.prototype, 'setItem');
    markPlanningNavInitialExposure({ role: 'viewer', pathname: '/kiosk' });
    recordPlanningNavTelemetry({ eventName: 'planning_nav_visibility_changed', role: 'viewer', trigger: 'init' });
    expect(firestore.addDoc).not.toHaveBeenCalled();
    expect(fetchFallback).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });

  it('blocks pending entry and pending exit, then permits committed exit', () => {
    window.history.replaceState(null, '', '/today');
    const state: { location: { pathname: string }; navigation: { location?: { pathname: string } } } = {
      location: { pathname: '/today' }, navigation: {},
    };
    let notify = () => {};
    const disconnect = bindKioskAutomaticTelemetryRouter({ state, subscribe: (fn) => { notify = fn; return () => {}; } });
    const emit = () => recordPlanningNavTelemetry({ eventName: 'planning_nav_visibility_changed', role: 'viewer', pathname: '/today', trigger: 'init' });
    try {
      state.navigation.location = { pathname: '/kiosk' }; notify(); emit();
      expect(firestore.addDoc).not.toHaveBeenCalled();
      state.location.pathname = '/kiosk'; state.navigation.location = { pathname: '/today' }; notify(); emit();
      expect(firestore.addDoc).not.toHaveBeenCalled();
      state.location.pathname = '/today'; state.navigation = {}; notify(); emit();
      expect(firestore.addDoc).toHaveBeenCalledTimes(1);
    } finally { disconnect(); }
  });

  it('rechecks the boundary immediately before sending even after entry and exit during preparation', () => {
    window.history.replaceState(null, '', '/today');
    const state = { location: { pathname: '/today' }, navigation: {} };
    let notify = () => {};
    const disconnect = bindKioskAutomaticTelemetryRouter({ state, subscribe: (fn) => { notify = fn; return () => {}; } });
    firestore.beforeDb = () => {
      state.location.pathname = '/kiosk'; notify();
      state.location.pathname = '/today'; notify();
    };
    try {
      recordPlanningNavTelemetry({ eventName: 'planning_nav_visibility_changed', role: 'viewer', pathname: '/today', trigger: 'init' });
      recordHubTelemetry({ eventName: 'hub_viewed', hubId: 'today', role: 'staff', telemetryName: 'hub', pathname: '/today' });
      recordLanding({ path: '/today', search: '', role: 'staff', referrer: '', userAgent: 'test' });
      expect(firestore.addDoc).not.toHaveBeenCalled();
    } finally { disconnect(); }
  });

  it('does not alter user-action telemetry or a neighbouring non-Kiosk path', () => {
    window.history.replaceState(null, '', '/kiosk');
    recordPlanningNavTelemetry({ eventName: 'planning_nav_settings_toggled', role: 'viewer', trigger: 'user_toggle', pathname: '/kiosk' });
    recordHubTelemetry({ eventName: 'hub_card_clicked', hubId: 'today', role: 'staff', telemetryName: 'click', pathname: '/kiosk' });
    expect(firestore.addDoc).toHaveBeenCalledTimes(2);
    window.history.replaceState(null, '', '/kiosk-other');
    recordLanding({ path: '/kiosk-other', search: '', role: 'staff', referrer: '', userAgent: 'test' });
    expect(firestore.addDoc).toHaveBeenCalledTimes(3);
  });
});
