import type { KioskTelemetryEventName } from './kioskNavigationTelemetry.types';

export interface KioskUxKpis {
  navigateFromTodayBreakdown: Record<string, number>;
  returnToTodayBreakdown: Record<string, number>;
  openFabMenuCount: number;
  totalNavigateCount: number;
  kioskSessionCount: number;
  visibleRefreshCount: number;
  visibleRefreshMedianMs: number | null;
  quickRecordSaveCount: number;
  quickRecordSaveMedianMs: number | null;
  quickRecordAbandonCount: number;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }
  return Math.round(sorted[middle]);
}

export function computeKioskUxKpis(events: Record<string, unknown>[]): KioskUxKpis {
  const kpis: KioskUxKpis = {
    navigateFromTodayBreakdown: {},
    returnToTodayBreakdown: {},
    openFabMenuCount: 0,
    totalNavigateCount: 0,
    kioskSessionCount: 0,
    visibleRefreshCount: 0,
    visibleRefreshMedianMs: null,
    quickRecordSaveCount: 0,
    quickRecordSaveMedianMs: null,
    quickRecordAbandonCount: 0,
  };

  let totalNavigate = 0;
  const visibleRefreshDurations: number[] = [];
  const quickRecordSaveDurations: number[] = [];

  for (const ev of events) {
    if (ev.type !== 'kiosk_ux_event') continue;

    const eventName = ev.event as KioskTelemetryEventName;
    const target = (typeof ev.target === 'string' ? ev.target : 'unknown');
    const source = (typeof ev.source === 'string' ? ev.source : 'unknown');

    if (eventName === 'ux_navigate_from_today') {
      kpis.navigateFromTodayBreakdown[target] = (kpis.navigateFromTodayBreakdown[target] || 0) + 1;
      totalNavigate += 1;
    } else if (eventName === 'ux_return_to_today') {
      kpis.returnToTodayBreakdown[source] = (kpis.returnToTodayBreakdown[source] || 0) + 1;
    } else if (eventName === 'ux_open_fab_menu') {
      kpis.openFabMenuCount += 1;
    } else if (eventName === 'ux_kiosk_session_started') {
      kpis.kioskSessionCount += 1;
    } else if (eventName === 'ux_visible_refresh_completed') {
      kpis.visibleRefreshCount += 1;
      const duration = typeof ev.durationMs === 'number' ? ev.durationMs : null;
      if (duration != null && Number.isFinite(duration) && duration >= 0) {
        visibleRefreshDurations.push(duration);
      }
    } else if (eventName === 'ux_quick_record_save_completed') {
      kpis.quickRecordSaveCount += 1;
      const duration = typeof ev.durationMs === 'number' ? ev.durationMs : null;
      if (duration != null && Number.isFinite(duration) && duration >= 0) {
        quickRecordSaveDurations.push(duration);
      }
    } else if (eventName === 'ux_quick_record_abandoned') {
      kpis.quickRecordAbandonCount += 1;
    }
  }

  kpis.totalNavigateCount = totalNavigate;
  kpis.visibleRefreshMedianMs = median(visibleRefreshDurations);
  kpis.quickRecordSaveMedianMs = median(quickRecordSaveDurations);
  return kpis;
}
