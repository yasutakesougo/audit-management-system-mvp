import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { alpha, createTheme, ThemeProvider as MUIThemeProvider, type ThemeOptions } from '@mui/material/styles';

// Base (shared) design tokens
const base: ThemeOptions = {
  typography: { fontSize: 15 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 44,
          padding: '8px 16px',
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
          color: theme.palette.primary.dark ?? '#0d47a1',
          borderColor: theme.palette.primary.dark ?? '#0d47a1',
          backgroundColor: theme.palette.mode === 'dark'
            ? alpha(theme.palette.primary.dark ?? theme.palette.primary.main, 0.12)
            : theme.palette.common.white,
          '&.MuiButton-sizeSmall': {
            color: theme.palette.primary.dark ?? '#0d47a1',
            borderColor: theme.palette.primary.dark ?? '#0d47a1',
            fontWeight: 600,
          },
          '&[aria-pressed="false"]': {
            backgroundColor: theme.palette.common.white,
          },
          '&:hover': {
            borderColor: theme.palette.primary.dark ?? '#0d47a1',
            backgroundColor: theme.palette.action.hover,
          },
          '&:active': {
            color: theme.palette.primary.dark ?? '#0d47a1',
            borderColor: theme.palette.primary.dark ?? '#0d47a1',
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
