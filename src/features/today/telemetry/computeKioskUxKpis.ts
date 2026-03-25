import type { KioskTelemetryEventName } from './kioskNavigationTelemetry.types';

export interface KioskUxKpis {
  navigateFromTodayBreakdown: Record<string, number>;
  returnToTodayBreakdown: Record<string, number>;
  openFabMenuCount: number;
  totalNavigateCount: number;
}

export function computeKioskUxKpis(events: Record<string, unknown>[]): KioskUxKpis {
  const kpis: KioskUxKpis = {
    navigateFromTodayBreakdown: {},
    returnToTodayBreakdown: {},
    openFabMenuCount: 0,
    totalNavigateCount: 0,
  };

  let totalNavigate = 0;

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
    }
  }

  kpis.totalNavigateCount = totalNavigate;
  return kpis;
}
