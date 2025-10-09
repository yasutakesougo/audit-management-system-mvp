import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Home from '@/app/Home';
import { FeatureFlagsProvider, type FeatureFlagSnapshot } from '@/config/featureFlags';

const isDemoModeEnabledMock = vi.fn((): boolean => false);
const featureFlagsState = vi.hoisted<FeatureFlagSnapshot>(() => ({
  schedules: false,
  schedulesCreate: false,
  complianceForm: false,
}));

vi.mock('@/lib/env', () => ({
  isDemoModeEnabled: () => isDemoModeEnabledMock(),
  isSchedulesFeatureEnabled: () => featureFlagsState.schedules,
  isSchedulesCreateEnabled: () => featureFlagsState.schedulesCreate,
  isComplianceFormEnabled: () => featureFlagsState.complianceForm,
  shouldSkipLogin: () => false,
}));

const renderHome = () =>
  render(
    <FeatureFlagsProvider value={{ ...featureFlagsState }}>
      <ThemeProvider theme={createTheme()}>
        <MemoryRouter>
          <Home />
        </MemoryRouter>
      </ThemeProvider>
    </FeatureFlagsProvider>,
  );

describe('Home', () => {
  beforeEach(() => {
    isDemoModeEnabledMock.mockReset();
    isDemoModeEnabledMock.mockReturnValue(false);
    featureFlagsState.schedules = false;
    featureFlagsState.schedulesCreate = false;
    featureFlagsState.complianceForm = false;
  });

  it('hides schedule tiles and chips when schedule flag disabled', () => {
    renderHome();
    expect(screen.queryByTestId('home-tile-schedule')).toBeNull();
    expect(screen.queryByRole('link', { name: 'マスタースケジュールへ移動' })).toBeNull();
    expect(screen.getByRole('list', { name: '主要機能のタイル一覧' })).toBeInTheDocument();
    expect(screen.getByTestId('home-mode-chip')).toHaveTextContent('本番モード（MSAL 認証あり）');
    expect(screen.queryByTestId('home-data-source-chip')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-demo-fallback-banner')).not.toBeInTheDocument();
  });

  it('shows schedule tiles and chips when flag enabled', () => {
    featureFlagsState.schedules = true;
    renderHome();
    expect(screen.getByTestId('home-tile-schedule')).toBeVisible();
    const chips = screen.getAllByTestId('home-data-source-chip');
    expect(chips[0]).toHaveTextContent('データソース: Demo');
  });

  it('indicates when demo mode is active', () => {
    isDemoModeEnabledMock.mockReturnValue(true);
    featureFlagsState.schedules = true;
    renderHome();
    expect(screen.getByText('デモモードが有効です')).toBeVisible();
    const chips = screen.getAllByTestId('home-data-source-chip');
    expect(chips[0]).toHaveTextContent('データソース: Demo');
  });
});
