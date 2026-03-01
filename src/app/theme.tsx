import CssBaseline from '@mui/material/CssBaseline';
import { alpha, createTheme, ThemeProvider as MUIThemeProvider, type Theme, type ThemeOptions } from '@mui/material/styles';
import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Theme Configuration (Phase 1: Light mode baseline + Dark mode foundation)
 *
 * Current Status:
 * - Light mode: Active and optimized (Phase 1 complete)
 * - Dark mode: Foundation ready (palette defined, not yet exposed to UI)
 *
 * Next Steps (Phase 2):
 * - Add theme toggle UI (ColorModeContext.toggle already implemented)
 * - Test dark mode visual hierarchy and readability
 * - Update E2E tests to cover both modes
 */

type ServiceTypeKey = 'normal' | 'transport' | 'respite' | 'nursing' | 'absence' | 'other';

export type ServiceTypeColorTokens = {
  bg: string;
  border: string;
  pillBg: string;
  pillText: string;
  accent: string;
};

declare module '@mui/material/styles' {
  interface Theme {
    serviceTypeColors: Record<ServiceTypeKey, ServiceTypeColorTokens>;
  }

  interface ThemeOptions {
    serviceTypeColors?: Partial<Record<ServiceTypeKey, Partial<ServiceTypeColorTokens>>>;
  }
}

const SERVICE_COLOR_BASE: Record<ServiceTypeKey, { main: string; accent?: string; pillText?: string }> = {
  normal: { main: '#0EA5E9', accent: '#0369A1' },
  transport: { main: '#16A34A', accent: '#15803D' },
  respite: { main: '#F59E0B', accent: '#B45309', pillText: '#1C1917' },
  nursing: { main: '#A855F7', accent: '#7C3AED' },
  absence: { main: '#94A3B8', accent: '#475569', pillText: '#F8FAFC' },
  other: { main: '#14B8A6', accent: '#0F766E' },
};

const buildServiceTypeColors = (theme: Theme): Record<ServiceTypeKey, ServiceTypeColorTokens> => {
  const backgroundAlpha = theme.palette.mode === 'dark' ? 0.35 : 0.18;
  const borderAlpha = theme.palette.mode === 'dark' ? 0.75 : 0.5;

  const createTokens = (config: { main: string; accent?: string; pillText?: string }): ServiceTypeColorTokens => {
    const accent = config.accent ?? config.main;
    return {
      bg: alpha(config.main, backgroundAlpha),
      border: alpha(accent, borderAlpha),
      pillBg: accent,
      pillText: config.pillText ?? theme.palette.getContrastText(accent),
      accent,
    };
  };

  return {
    normal: createTokens(SERVICE_COLOR_BASE.normal),
    transport: createTokens(SERVICE_COLOR_BASE.transport),
    respite: createTokens(SERVICE_COLOR_BASE.respite),
    nursing: createTokens(SERVICE_COLOR_BASE.nursing),
    absence: createTokens(SERVICE_COLOR_BASE.absence),
    other: createTokens(SERVICE_COLOR_BASE.other),
  };
};

// Base (shared) design tokens
const base: ThemeOptions = {
  typography: {
    fontSize: 16,
    body1: { lineHeight: 1.7 },
    body2: { lineHeight: 1.7 },
    h1: { fontSize: '1.75rem', lineHeight: 1.4, fontWeight: 700 },
    h2: { fontSize: '1.375rem', lineHeight: 1.5, fontWeight: 600 },
    h3: { fontSize: '1.125rem', lineHeight: 1.5, fontWeight: 600 },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 48,
          padding: '10px 20px',
          '&:focus-visible': { outline: '3px solid currentColor', outlineOffset: 2 },
          '&.Mui-disabled': { opacity: 1 },
        },
        containedInfo: ({ theme }) => ({
          color: theme.palette.info.contrastText,
          '&.Mui-disabled': {
            color: theme.palette.mode === 'dark' ? theme.palette.grey[900] : theme.palette.grey[50],
            backgroundColor: theme.palette.action.disabledBackground,
          },
        }),
        outlinedSecondary: ({ theme }) => ({
          color: theme.palette.secondary.main,
          borderColor: theme.palette.secondary.main,
          '&:hover': { borderColor: theme.palette.secondary.dark ?? theme.palette.secondary.main },
          '&.Mui-disabled': {
            color: theme.palette.grey[600],
            borderColor: theme.palette.grey[400],
            backgroundColor: theme.palette.action.disabledBackground,
          },
        }),
        outlinedPrimary: ({ theme }) => ({
          color: theme.palette.primary.dark,
          borderColor: theme.palette.primary.dark,
          backgroundColor: theme.palette.mode === 'dark'
            ? alpha(theme.palette.primary.dark ?? theme.palette.primary.main, 0.12)
            : theme.palette.common.white,
          '&.MuiButton-sizeSmall': {
            color: theme.palette.primary.dark,
            borderColor: theme.palette.primary.dark,
            fontWeight: 600,
          },
          '&[aria-pressed="false"]': {
            backgroundColor: theme.palette.common.white,
          },
          '&:hover': {
            borderColor: theme.palette.primary.dark,
            backgroundColor: theme.palette.action.hover,
          },
          '&:active': {
            color: theme.palette.primary.dark,
            borderColor: theme.palette.primary.dark,
            backgroundColor: theme.palette.action.selected,
          },
          '&.Mui-disabled': {
            color: theme.palette.grey[700],
            borderColor: theme.palette.grey[500],
          },
          '&:focus-visible': {
            outline: '2px solid currentColor',
            outlineOffset: 2,
          },
        }),
      },
    },
    MuiIconButton: { styleOverrides: { root: { minWidth: 48, minHeight: 48 } } },
    MuiTextField: { styleOverrides: { root: { '& .MuiInputBase-root': { minHeight: 48 } } } },
    MuiListItemButton: { styleOverrides: { root: { minHeight: 48, py: 1.5 } } },
    MuiMenuItem: { styleOverrides: { root: { minHeight: 48, py: 1.5 } } },
    MuiTab: { styleOverrides: { root: { minHeight: 48 } } },
    MuiCssBaseline: { styleOverrides: `*:focus-visible{outline:3px solid #5B8C5A;outline-offset:2px}` },
  },
} as const;

export const ColorModeContext = createContext<{ mode: 'light' | 'dark'; toggle: () => void; sticky?: boolean }>({ mode: 'light', toggle: () => {} });

/**
 * SSR-safe initial mode detection
 */
const getInitialMode = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light';
  const saved = localStorage.getItem('app_color_mode');
  return (saved as 'light' | 'dark') || 'light';
};

export const ThemeRoot: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<'light' | 'dark'>(getInitialMode);

  useEffect(() => {
    localStorage.setItem('app_color_mode', mode);
  }, [mode]);

  const toggle = useCallback(
    () => setMode((m) => (m === 'light' ? 'dark' : 'light')),
    [],
  );

  const theme = useMemo(() => {
    const baseTheme = createTheme({
      palette:
        mode === 'dark'
          ? {
              mode: 'dark',
              primary: { main: '#86C485', dark: '#6BA36A' },
              secondary: { main: '#9CA3AF', dark: '#6B7280' },
              info: { main: '#86C485', contrastText: '#0A1929' },
              background: {
                default: '#0D1117',  // GitHub dark base
                paper: '#161B22',    // Card backgrounds
              },
              text: {
                primary: '#E6EDF3',  // High contrast for readability
                secondary: '#8B949E', // Muted text
              },
            }
          : {
              mode: 'light',
              primary: { main: '#5B8C5A', light: '#E8F0E4', dark: '#3D6B3C' },
              secondary: { main: '#6B7280', contrastText: '#ffffff' },
              info: { main: '#5B8C5A', dark: '#3D6B3C', contrastText: '#ffffff' },
              warning: { main: '#D4A843' },
              error: { main: '#C94A4A' },
              background: { default: '#F5F7F4', paper: '#FFFFFF' },
              text: { primary: '#1F2933', secondary: '#4B5563' },
              divider: 'rgba(0,0,0,0.08)',
            },
      ...base,
    });

    return createTheme(baseTheme, {
      serviceTypeColors: buildServiceTypeColors(baseTheme),
    });
  }, [mode]);

  const ctx = useMemo(
    () => ({ mode, toggle, sticky: false }),
    [mode, toggle],
  );

  return (
    <ColorModeContext.Provider value={ctx}>
      <MUIThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MUIThemeProvider>
    </ColorModeContext.Provider>
  );
};

// Simple hook for convenience (optional)
export const useColorMode = () => React.useContext(ColorModeContext);
// (end of file)

/**
 * Density-aware spacing configuration
 * Maps UserSettings.density to base spacing unit
 */
export const densitySpacingMap = {
  compact: 4,      // Tighter spacing
  comfortable: 8,  // Default spacing
  spacious: 12,    // Generous spacing
} as const;

export type Density = keyof typeof densitySpacingMap;

/**
 * Apply density settings to document CSS variables
 * Usage: applyDensityToDocument('comfortable')
 *
 * This enables dynamic theme updates without recreating theme object
 */
export function applyDensityToDocument(density: Density): void {
  const baseSpacing = densitySpacingMap[density];
  const root = typeof document !== 'undefined' ? document.documentElement : null;

  if (root) {
    root.style.setProperty('--theme-density-base', `${baseSpacing}px`);
    root.style.setProperty('--theme-density-factor', String(baseSpacing / 8)); // Relative to comfortable
  }
}

export const uiTokens = {
  containerMaxWidth: 1200,
  spacingYSection: { xs: 16, sm: 24, md: 32 },
  cardPadding: { xs: 16, sm: 20, md: 24 },
  maxTextWidth: '80ch',
  heading: {
    h1: 28,
    h2: 22,
  },
} as const;
