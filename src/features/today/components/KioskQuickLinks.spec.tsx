import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { KioskQuickLinks } from './KioskQuickLinks';
import { KIOSK_TELEMETRY_EVENTS } from '../telemetry/kioskNavigationTelemetry.types';

const mockUseFeatureFlags = vi.fn();
const mockUseUserAuthz = vi.fn();
const mockRecordKioskTelemetry = vi.fn();

vi.mock('@/config/featureFlags', () => ({
  useFeatureFlags: () => mockUseFeatureFlags(),
}));

vi.mock('@/auth/useUserAuthz', () => ({
  useUserAuthz: () => mockUseUserAuthz(),
}));

vi.mock('../telemetry/recordKioskTelemetry', () => ({
  recordKioskTelemetry: (...args: unknown[]) => mockRecordKioskTelemetry(...args),
}));

describe('KioskQuickLinks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const viewerFlags = {
    schedules: true,
    complianceForm: false,
    schedulesWeekV2: false,
    icebergPdca: false,
    staffAttendance: false,
    todayOps: true,
    todayLiteUi: false,
    todayLiteNavV2: false,
  };

  it('hides schedule link when schedules feature is disabled', () => {
    mockUseFeatureFlags.mockReturnValue({
      ...viewerFlags,
      schedules: false,
    });
    mockUseUserAuthz.mockReturnValue({ role: 'viewer', ready: true });

    render(<KioskQuickLinks onNavigate={vi.fn()} />);

    expect(screen.queryByTestId('kiosk-quick-link-schedule')).not.toBeInTheDocument();
    expect(screen.getByTestId('kiosk-quick-link-handoff')).toBeInTheDocument();
  });

  it('shows renamed labels for minutes and briefing actions', () => {
    mockUseFeatureFlags.mockReturnValue(viewerFlags);
    mockUseUserAuthz.mockReturnValue({ role: 'viewer', ready: true });

    render(<KioskQuickLinks onNavigate={vi.fn()} />);

    expect(screen.getByTestId('kiosk-quick-link-minutes')).toBeInTheDocument();
    expect(screen.getByTestId('kiosk-quick-link-briefing')).toBeInTheDocument();
    expect(screen.getByText('議事録記録')).toBeInTheDocument();
    expect(screen.getByText('朝夕会進行')).toBeInTheDocument();
  });

  it('records telemetry with target=link.id for schedule click and keeps navigation behavior', () => {
    mockUseFeatureFlags.mockReturnValue(viewerFlags);
    mockUseUserAuthz.mockReturnValue({ role: 'viewer', ready: true });
    const onNavigate = vi.fn();

    render(<KioskQuickLinks onNavigate={onNavigate} />);

    fireEvent.click(screen.getByTestId('kiosk-quick-link-schedule'));

    expect(mockRecordKioskTelemetry).toHaveBeenCalledWith(
      KIOSK_TELEMETRY_EVENTS.NAVIGATE_FROM_TODAY,
      expect.objectContaining({
        mode: 'kiosk',
        source: 'today',
        target: 'schedule',
        to: '/schedules/week',
      }),
    );
    expect(onNavigate).toHaveBeenCalledWith('/schedules/week');
  });

  it('records telemetry with target=link.id for briefing click', () => {
    mockUseFeatureFlags.mockReturnValue(viewerFlags);
    mockUseUserAuthz.mockReturnValue({ role: 'viewer', ready: true });

    render(<KioskQuickLinks onNavigate={vi.fn()} />);

    fireEvent.click(screen.getByTestId('kiosk-quick-link-briefing'));

    expect(mockRecordKioskTelemetry).toHaveBeenCalledWith(
      KIOSK_TELEMETRY_EVENTS.NAVIGATE_FROM_TODAY,
      expect.objectContaining({
        target: 'briefing',
        to: '/dashboard/briefing',
      }),
    );
  });
});
