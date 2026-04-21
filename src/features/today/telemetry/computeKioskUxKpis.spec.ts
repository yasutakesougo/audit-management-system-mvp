import { describe, expect, it } from 'vitest';
import { computeKioskUxKpis } from './computeKioskUxKpis';

describe('computeKioskUxKpis', () => {
  it('aggregates kiosk flow counts', () => {
    const result = computeKioskUxKpis([
      { type: 'kiosk_ux_event', event: 'ux_navigate_from_today', target: 'schedule', source: 'today' },
      { type: 'kiosk_ux_event', event: 'ux_navigate_from_today', target: 'schedule', source: 'today', to: '/schedules/week' },
      { type: 'kiosk_ux_event', event: 'ux_navigate_from_today', target: 'briefing', source: 'today', to: '/dashboard/briefing' },
      { type: 'kiosk_ux_event', event: 'ux_return_to_today', source: 'header_back' },
      { type: 'kiosk_ux_event', event: 'ux_open_fab_menu', source: 'fab' },
      { type: 'kiosk_ux_event', event: 'ux_kiosk_session_started', source: 'today' },
      { type: 'kiosk_ux_event', event: 'ux_quick_record_started', source: 'today' },
    ]);

    expect(result.navigateFromTodayBreakdown.schedule).toBe(2);
    expect(result.navigateFromTodayBreakdown.briefing).toBe(1);
    expect(result.returnToTodayBreakdown.header_back).toBe(1);
    expect(result.openFabMenuCount).toBe(1);
    expect(result.totalNavigateCount).toBe(3);
    expect(result.kioskSessionCount).toBe(1);
    expect(result.quickRecordStartCount).toBe(1);
  });

  it('calculates median metrics for visibility refresh and quick record save', () => {
    const result = computeKioskUxKpis([
      { type: 'kiosk_ux_event', event: 'ux_visible_refresh_completed', durationMs: 800, source: 'today' },
      { type: 'kiosk_ux_event', event: 'ux_visible_refresh_completed', durationMs: 200, source: 'today' },
      { type: 'kiosk_ux_event', event: 'ux_visible_refresh_completed', durationMs: 500, source: 'today' },
      { type: 'kiosk_ux_event', event: 'ux_quick_record_save_completed', durationMs: 26000, source: 'today' },
      { type: 'kiosk_ux_event', event: 'ux_quick_record_save_completed', durationMs: 12000, source: 'today' },
      { type: 'kiosk_ux_event', event: 'ux_quick_record_abandoned', source: 'today' },
      { type: 'kiosk_ux_event', event: 'ux_quick_record_started', source: 'today' },
      { type: 'kiosk_ux_event', event: 'ux_quick_record_started', source: 'today' },
      { type: 'kiosk_ux_event', event: 'ux_quick_record_started', source: 'today' },
    ]);

    expect(result.visibleRefreshCount).toBe(3);
    expect(result.visibleRefreshMedianMs).toBe(500);
    expect(result.quickRecordSaveCount).toBe(2);
    expect(result.quickRecordSaveMedianMs).toBe(19000);
    expect(result.quickRecordAbandonCount).toBe(1);
    expect(result.quickRecordStartCount).toBe(3);
  });
});
