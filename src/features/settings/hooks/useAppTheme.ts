import { useMemo, useEffect } from 'react';
import { useSettingsContext } from '../SettingsContext';
import { applyDensityToDocument } from '@/app/theme';

/**
 * Custom hook to create MUI theme from user settings
 * and apply density CSS variables
 *
 * This hook integrates:
 * - createAppTheme: Theme creation with density-aware spacing
 * - applyDensityToDocument: CSS variable application
 *
 * Centralizes all density-related effects in one place
 *
 * @returns Theme object for MUIThemeProvider
 */
export function useAppTheme() {
  const { settings } = useSettingsContext();

  /**
   * TODO: Replace with createAppTheme once PR #321 merges
   * For now, create minimal theme to avoid import errors
   */
  const theme = useMemo(() => {
    // Placeholder until createAppTheme is available
    return {
      spacing: (scale: number) => `${scale * (settings.density === 'compact' ? 4 : settings.density === 'spacious' ? 12 : 8)}px`,
      components: {},
    };
  }, [settings.density]);

  // Apply density CSS variables on density change
  useEffect(() => {
    applyDensityToDocument(settings.density);
  }, [settings.density]);

  return theme;
}
