import { ColorModeContext } from '@/app/theme';
import type { NavItem } from '@/app/config/navigationConfig.types';
import {
  PLANNING_NAV_TELEMETRY_EVENTS,
  type PlanningNavTelemetryEvent,
} from '@/app/navigation/planningNavTelemetry';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsDialog } from '../SettingsDialog';
import type { UserSettings } from '../settingsModel';

let mockSettings: UserSettings;
const mockUpdateSettings = vi.fn();
const mockRecordPlanningNavTelemetry = vi.fn();

vi.mock('../SettingsContext', () => ({
  useSettingsContext: () => ({
    settings: mockSettings,
    updateSettings: mockUpdateSettings,
  }),
}));

vi.mock('@/app/navigation/planningNavTelemetry', async () => {
  const actual =
    await vi.importActual<typeof import('@/app/navigation/planningNavTelemetry')>(
      '@/app/navigation/planningNavTelemetry',
    );
  return {
    ...actual,
    recordPlanningNavTelemetry: (...args: unknown[]) =>
      mockRecordPlanningNavTelemetry(...args),
  };
});

const navItems: NavItem[] = [
  {
    label: 'Planning',
    to: '/planning',
    isActive: () => false,
    group: 'planning',
  },
  {
    label: 'Today',
    to: '/today',
    isActive: () => false,
    group: 'today',
  },
];

const locationProbeKey = 'location-probe';

const LocationProbe = () => {
  const location = useLocation();
  return <span data-testid={locationProbeKey} data-path={location.pathname} data-search={location.search} />;
};

const renderDialog = (initialPath = '/settings') =>
  render(
    <ColorModeContext.Provider value={{ mode: 'light', toggle: vi.fn() }}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="*"
            element={
              <>
                <LocationProbe />
                <SettingsDialog open onClose={vi.fn()} navItems={navItems} />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </ColorModeContext.Provider>,
  );

describe('SettingsDialog planning visibility behavior', () => {
  beforeEach(() => {
    mockSettings = {
      colorMode: 'system',
      density: 'comfortable',
      fontSize: 'medium',
      colorPreset: 'default',
      layoutMode: 'normal',
      hiddenNavGroups: [],
      navGroupVisibilityPrefs: {},
      hiddenNavItems: [],
      navPolicyVersion: 1,
      lastModified: 1,
    };
    mockUpdateSettings.mockReset();
    mockRecordPlanningNavTelemetry.mockReset();
  });

  it('updates explicit planning preference to hide when user toggles planning off', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('switch', { name: '🗓️ 計画・調整' }));

    expect(mockUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        hiddenNavGroups: ['planning'],
        navGroupVisibilityPrefs: expect.objectContaining({
          planning: 'hide',
        }),
      }),
    );
    expect(mockRecordPlanningNavTelemetry).toHaveBeenCalledWith(
      expect.objectContaining<Partial<PlanningNavTelemetryEvent>>({
        eventName: PLANNING_NAV_TELEMETRY_EVENTS.SETTINGS_TOGGLED,
        action: 'hide',
        visible: false,
        trigger: 'user_toggle',
      }),
    );
  });

  it('updates explicit planning preference to show when user toggles planning on', () => {
    mockSettings = {
      ...mockSettings,
      hiddenNavGroups: ['planning'],
      navGroupVisibilityPrefs: { planning: 'hide' },
    };
    renderDialog();
    fireEvent.click(screen.getByRole('switch', { name: '🗓️ 計画・調整' }));

    expect(mockUpdateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        hiddenNavGroups: [],
        navGroupVisibilityPrefs: expect.objectContaining({
          planning: 'show',
        }),
      }),
    );
    expect(mockRecordPlanningNavTelemetry).toHaveBeenCalledWith(
      expect.objectContaining<Partial<PlanningNavTelemetryEvent>>({
        eventName: PLANNING_NAV_TELEMETRY_EVENTS.SETTINGS_TOGGLED,
        action: 'show',
        visible: true,
        trigger: 'user_toggle',
      }),
    );
  });

  it('can disable kiosk mode even when forced by ?kiosk=1', async () => {
    mockSettings = {
      ...mockSettings,
      layoutMode: 'kiosk',
    };
    renderDialog('/today?kiosk=1');

    fireEvent.click(screen.getByRole('switch', { name: 'キオスクモード（タブレット端末用）' }));
    expect(mockUpdateSettings).toHaveBeenCalledWith({ layoutMode: 'normal' });

    await waitFor(() => {
      const probe = screen.getByTestId(locationProbeKey);
      expect(probe.getAttribute('data-path')).toBe('/today');
      expect(probe.getAttribute('data-search')).toBe('');
    });
  });

  it('exits to dashboard when disabling kiosk mode from /kiosk route', async () => {
    mockSettings = {
      ...mockSettings,
      layoutMode: 'kiosk',
    };
    renderDialog('/kiosk/users');

    fireEvent.click(screen.getByRole('switch', { name: 'キオスクモード（タブレット端末用）' }));
    expect(mockUpdateSettings).toHaveBeenCalledWith({ layoutMode: 'normal' });

    await waitFor(() => {
      const probe = screen.getByTestId(locationProbeKey);
      expect(probe.getAttribute('data-path')).toBe('/dashboard');
      expect(probe.getAttribute('data-search')).toBe('');
    });
  });
});
