import { ColorModeContext } from '@/app/theme';
import type { NavItem } from '@/app/config/navigationConfig.types';
import {
  PLANNING_NAV_TELEMETRY_EVENTS,
  type PlanningNavTelemetryEvent,
} from '@/app/navigation/planningNavTelemetry';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
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

const renderDialog = () =>
  render(
    <ColorModeContext.Provider value={{ mode: 'light', toggle: vi.fn() }}>
      <MemoryRouter initialEntries={['/settings']}>
        <SettingsDialog open onClose={vi.fn()} navItems={navItems} />
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
    fireEvent.click(screen.getByRole('switch', { name: /計画・調整/ }));

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
    fireEvent.click(screen.getByRole('switch', { name: /計画・調整/ }));

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
});
