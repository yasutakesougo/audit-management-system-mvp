import { describe, it, expect } from 'vitest';
import { createAppTheme } from '../createAppTheme';
import { defaultSettings } from '@/features/settings/settingsModel';

describe('createAppTheme', () => {
  describe('Density Spacing', () => {
    it('creates theme with comfortable density spacing (8px)', () => {
      const theme = createAppTheme({
        ...defaultSettings,
        density: 'comfortable',
      });

      expect(theme.spacing(1)).toBe('8px'); // comfortable = 8px
      expect(theme.spacing(2)).toBe('16px');
    });

    it('creates theme with compact density spacing (4px)', () => {
      const theme = createAppTheme({
        ...defaultSettings,
        density: 'compact',
      });

      expect(theme.spacing(1)).toBe('4px'); // compact = 4px
      expect(theme.spacing(2)).toBe('8px');
    });

    it('creates theme with spacious density spacing (12px)', () => {
      const theme = createAppTheme({
        ...defaultSettings,
        density: 'spacious',
      });

      expect(theme.spacing(1)).toBe('12px'); // spacious = 12px
      expect(theme.spacing(2)).toBe('24px');
    });
  });

  describe('Component Overrides', () => {
    it('applies density to button padding', () => {
      const theme = createAppTheme({
        ...defaultSettings,
        density: 'compact',
      });

      const buttonOverrides = theme.components?.MuiButton?.styleOverrides?.root;
      expect(buttonOverrides).toBeDefined();
      expect(typeof buttonOverrides).toBe('function');
    });

    it('applies density to DialogActions padding', () => {
      const theme = createAppTheme({
        ...defaultSettings,
        density: 'spacious',
      });

      const dialogActionsOverrides = theme.components?.MuiDialogActions?.styleOverrides?.root;
      expect(dialogActionsOverrides).toBeDefined();
    });

    it('applies TextField size based on density', () => {
      const compactTheme = createAppTheme({
        ...defaultSettings,
        density: 'compact',
      });

      const comfortableTheme = createAppTheme({
        ...defaultSettings,
        density: 'comfortable',
      });

      const spaciousTheme = createAppTheme({
        ...defaultSettings,
        density: 'spacious',
      });

      expect(compactTheme.components?.MuiTextField?.defaultProps?.size).toBe('small');
      expect(comfortableTheme.components?.MuiTextField?.defaultProps?.size).toBe('medium');
      expect(spaciousTheme.components?.MuiTextField?.defaultProps?.size).toBe('medium');
    });

    it('applies Card padding override', () => {
      const theme = createAppTheme({
        ...defaultSettings,
        density: 'comfortable',
      });

      const cardOverrides = theme.components?.MuiCard?.styleOverrides?.root;
      expect(cardOverrides).toBeDefined();
    });

    it('applies Stack default spacing', () => {
      const theme = createAppTheme({
        ...defaultSettings,
        density: 'comfortable',
      });

      const stackDefaults = theme.components?.MuiStack?.defaultProps;
      expect(stackDefaults?.spacing).toBe(2);
    });
  });

  describe('Pure Function Properties', () => {
    it('returns new theme object on each call (immutability)', () => {
      const settings = { ...defaultSettings, density: 'comfortable' as const };
      const theme1 = createAppTheme(settings);
      const theme2 = createAppTheme(settings);

      expect(theme1).not.toBe(theme2); // Different object references
      expect(theme1.spacing(1)).toBe(theme2.spacing(1)); // Same values
    });

    it('does not mutate input settings', () => {
      const settings = { ...defaultSettings, density: 'comfortable' as const };
      const settingsCopy = { ...settings };

      createAppTheme(settings);

      expect(settings).toEqual(settingsCopy);
    });
  });
});
