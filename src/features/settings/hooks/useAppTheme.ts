import { useMemo, useEffect } from 'react';
import { useSettingsContext } from '../SettingsContext';
import { applyDensityToDocument } from '@/app/theme';
import { createAppTheme } from '@/app/createAppTheme';

/**
 * Custom hook to create MUI theme from user settings
 * and apply density CSS variables
 *
 * This hook integrates:
 * - createAppTheme: Theme creation with density-aware spacing (from PR #321)
 * - applyDensityToDocument: CSS variable application
 *
 * Centralizes all density-related effects in one place
 *
 * @returns Theme object for MUIThemeProvider
 */
export function useAppTheme() {
  const { settings } = useSettingsContext();

  /**
   * Create theme with current settings
   * Memoized to avoid unnecessary recreations
   * Depends on density and fontSize changes
   */
  const theme = useMemo(() => {
    return createAppTheme(settings);
  }, [settings.density, settings.fontSize]);

  // Apply density CSS variables on density change
  useEffect(() => {
    applyDensityToDocument(settings.density);
  }, [settings.density]);

  return theme;
}
