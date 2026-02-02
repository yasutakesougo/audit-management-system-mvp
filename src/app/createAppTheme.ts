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
 * Font size map (Phase 7.1 - Font Size Control)
 * Maps user-selected fontSize preference to px values
 */
const fontSizeMap = {
  small: 12,       // Compact, high-density display
  medium: 14,      // Standard, balanced display
  large: 16,       // Accessible, spacious display
} as const;

/**
 * Color preset map (Phase 7.2 - Color Customization)
 * Maps user-selected colorPreset to palette colors
 * Note: 'custom' preset is reserved for Phase 7.2 v2 ColorPicker integration
 */
const colorPresetMap = {
  default: {
    primary: '#1976d2',      // MUI Blue
    secondary: '#dc004e',    // MUI Pink
  },
  highContrast: {
    primary: '#000000',      // Black
    secondary: '#ffffff',    // White
  },
  custom: {
    primary: '#1976d2',      // Placeholder - will be overridden in Phase 7.2 v2
    secondary: '#dc004e',
  },
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
  const baseFontSize = fontSizeMap[settings.fontSize];
  
  // Fallback to 'default' preset if colorPreset is not specified
  const safePresetKey = settings.colorPreset ?? 'default';
  const colorPreset = colorPresetMap[safePresetKey] ?? colorPresetMap.default;

  return createTheme({
    spacing: densityBase,
    typography: {
      fontSize: baseFontSize,
    },
    palette: {
      primary: { main: colorPreset.primary },
      secondary: { main: colorPreset.secondary },
    },
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
