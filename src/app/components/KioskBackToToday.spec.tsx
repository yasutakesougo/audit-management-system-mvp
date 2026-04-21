import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SettingsProvider } from '@/features/settings';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '@/features/settings/settingsModel';
import { KioskBackToToday } from './KioskBackToToday';

function renderWithPath(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SettingsProvider>
        <Routes>
          <Route path="*" element={<KioskBackToToday />} />
        </Routes>
      </SettingsProvider>
    </MemoryRouter>,
  );
}

describe('KioskBackToToday', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shows when kiosk is enabled by URL query even if settings layoutMode is normal', () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        layoutMode: 'normal',
      }),
    );

    renderWithPath('/call-logs?kiosk=1');

    expect(screen.getByTestId('kiosk-back-to-today')).toBeInTheDocument();
  });

  it('shows on /dashboard when kiosk mode is enabled in settings', () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        layoutMode: 'kiosk',
      }),
    );

    renderWithPath('/dashboard');

    expect(screen.getByTestId('kiosk-back-to-today')).toBeInTheDocument();
  });

  it('hides on /today in kiosk mode', () => {
    localStorage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        layoutMode: 'kiosk',
      }),
    );

    renderWithPath('/today?kiosk=1');

    expect(screen.queryByTestId('kiosk-back-to-today')).not.toBeInTheDocument();
  });
});
