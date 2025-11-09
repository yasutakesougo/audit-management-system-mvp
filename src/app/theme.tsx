import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { createTheme, ThemeProvider as MUIThemeProvider } from '@mui/material/styles';

// Base (shared) design tokens
const base = {
  typography: { fontSize: 15 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { minHeight: 44, padding: '8px 16px' },
        containedInfo: { color: '#ffffff' },
        outlinedSecondary: {
          color: '#3b3b44',
          borderColor: '#3b3b44',
          '&:hover': { borderColor: '#2a2a31' },
        },
      },
    },
    MuiIconButton: { styleOverrides: { root: { minWidth: 44, minHeight: 44 } } },
    MuiTextField: { styleOverrides: { root: { '& .MuiInputBase-root': { minHeight: 44 } } } },
    MuiCssBaseline: { styleOverrides: `*:focus-visible{outline:3px solid #0078d4;outline-offset:2px}` },
  },
} as const;

export const ColorModeContext = createContext<{ mode: 'light' | 'dark'; toggle: () => void; sticky?: boolean }>({ mode: 'light', toggle: () => {} });

export const ThemeRoot: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<'light' | 'dark'>(() => (localStorage.getItem('app_color_mode') as 'light' | 'dark') || 'light');
  useEffect(() => { localStorage.setItem('app_color_mode', mode); }, [mode]);
  const toggle = useCallback(() => setMode(m => (m === 'light' ? 'dark' : 'light')), []);
  const theme = useMemo(() => createTheme({
    palette: mode === 'dark'
      ? {
          mode: 'dark',
          primary: { main: '#7BB8FF' },
          secondary: { main: '#7AD48A' },
          info: { main: '#58A6FF', contrastText: '#0A1929' },
        }
      : {
          mode: 'light',
          primary: { main: '#00529B' },
          secondary: { main: '#3b3b44', contrastText: '#ffffff' },
          info: { main: '#026aa2', dark: '#01507a', contrastText: '#ffffff' },
          background: { default: '#F5F5F5' },
        },
    ...base,
  }), [mode]);
  const ctx = useMemo(() => ({ mode, toggle, sticky: false }), [mode, toggle]);
  return <ColorModeContext.Provider value={ctx}><MUIThemeProvider theme={theme}>{children}</MUIThemeProvider></ColorModeContext.Provider>;
};

// Simple hook for convenience (optional)
export const useColorMode = () => React.useContext(ColorModeContext);
// (end of file)

export const uiTokens = {
  containerMaxWidth: 1120,
  spacingYSection: 16,
  heading: {
    h1: 28,
    h2: 22,
  },
} as const;
