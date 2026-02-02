import { createTheme, type Theme } from '@mui/material/styles';
import type { UserSettings } from '@/features/settings/settingsModel';

/**
 * Density spacing map (Phase 5 - local definition)
 * TODO: Import from theme.tsx when PR #319 is merged
 */
const densitySpacingMap = {
  compact: 4,      // Tighter spacing
  comfortable: 8,  // Default spacing
  spacious: 12,    // Generous spacing
} as const;

/**
 * Creates MUI theme with user settings (density, fontSize, etc.)
 * 
 * Pure function - no side effects, easy to test
 * 
 * @param settings - User settings from SettingsContext
 * @returns MUI Theme object with density-aware spacing
 * 
 * @example
 * ```typescript
 * const theme = createAppTheme({ density: 'compact', ... });
 * // theme.spacing(1) === 4px
 * ```
 */
export function createAppTheme(settings: UserSettings): Theme {
  const densityBase = densitySpacingMap[settings.density];

  return createTheme({
    spacing: densityBase,
    components: {
      // Button - density-aware padding
      MuiButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            padding: theme.spacing(1, 2),
          }),
        },
      },

      // DialogActions - consistent spacing
      MuiDialogActions: {
        styleOverrides: {
          root: ({ theme }) => ({
            padding: theme.spacing(2),
          }),
        },
      },

      // TextField - density-aware size
      MuiTextField: {
        defaultProps: {
          size: settings.density === 'compact' ? 'small' : 'medium',
        },
      },

      // Card - density-aware padding
      MuiCard: {
        styleOverrides: {
          root: ({ theme }) => ({
            padding: theme.spacing(2),
          }),
        },
      },

      // Stack - default spacing from theme
      MuiStack: {
        defaultProps: {
          spacing: 2, // Uses theme.spacing(2)
        },
      },
    },
  });
}
