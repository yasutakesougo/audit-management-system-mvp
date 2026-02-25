/**
 * SettingsModel unit tests
 * - localStorage persistence
 * - schema validation
 * - defaults fallback
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    DEFAULT_SETTINGS,
    loadSettingsFromStorage,
    mergeSettings,
    saveSettingsToStorage,
    SETTINGS_STORAGE_KEY,
    type UserSettings,
} from '../settingsModel';

describe('settingsModel', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('loadSettingsFromStorage', () => {
    it('returns defaults when localStorage is empty', () => {
      const loaded = loadSettingsFromStorage();
      expect(loaded).toEqual(DEFAULT_SETTINGS);
    });

    it('loads valid settings from storage', () => {
      const settings: UserSettings = {
        colorMode: 'dark',
        density: 'compact',
        fontSize: 'large',
        colorPreset: 'highContrast',
        layoutMode: 'normal',
        lastModified: 1234567890,
      };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));

      const loaded = loadSettingsFromStorage();
      expect(loaded.colorMode).toBe('dark');
      expect(loaded.density).toBe('compact');
      expect(loaded.fontSize).toBe('large');
    });

    it('returns defaults when JSON is invalid', () => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, 'invalid json {');
      const loaded = loadSettingsFromStorage();
      expect(loaded).toEqual(DEFAULT_SETTINGS);
    });

    it('returns defaults when schema is incomplete', () => {
      const invalid = { colorMode: 'dark' }; // missing required fields
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(invalid));
      const loaded = loadSettingsFromStorage();
      expect(loaded).toEqual(DEFAULT_SETTINGS);
    });

    it('preserves colorPreset field with fallback to default', () => {
      const partial = {
        colorMode: 'dark',
        density: 'comfortable',
        fontSize: 'medium',
        // no colorPreset
        lastModified: Date.now(),
      };
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(partial));

      const loaded = loadSettingsFromStorage();
      expect(loaded.colorPreset).toBe('default');
    });
  });

  describe('saveSettingsToStorage', () => {
    it('saves settings to localStorage', () => {
      const settings: UserSettings = {
        colorMode: 'dark',
        density: 'compact',
        fontSize: 'small',
        colorPreset: 'default',
        layoutMode: 'normal',
        lastModified: 1234567890,
      };

      const result = saveSettingsToStorage(settings);
      expect(result).toBe(true);

      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      expect(stored).toBeTruthy();

      const parsed = JSON.parse(stored!);
      expect(parsed.colorMode).toBe('dark');
      expect(parsed.density).toBe('compact');
    });

    it('updates lastModified timestamp on save', () => {
      const settings = { ...DEFAULT_SETTINGS, lastModified: 0 };
      const before = Date.now();
      saveSettingsToStorage(settings);
      const after = Date.now();

      const stored = JSON.parse(
        localStorage.getItem(SETTINGS_STORAGE_KEY)!
      );
      expect(stored.lastModified).toBeGreaterThanOrEqual(before);
      expect(stored.lastModified).toBeLessThanOrEqual(after);
    });

    it('returns true on success', () => {
      const result = saveSettingsToStorage(DEFAULT_SETTINGS);
      expect(result).toBe(true);
    });

    it('returns false gracefully on quota exceeded', () => {
      const setItemSpy = vi.spyOn(localStorage, 'setItem');
      const quotaError = new DOMException('QuotaExceededError', 'QuotaExceededError');
      // DOMException.code is read-only, but QuotaExceededError has code 22 by name
      setItemSpy.mockImplementation(() => {
        throw quotaError;
      });

      const result = saveSettingsToStorage(DEFAULT_SETTINGS);
      expect(result).toBe(false);

      setItemSpy.mockRestore();
    });
  });

  describe('mergeSettings', () => {
    it('merges partial updates with current state', () => {
      const current = DEFAULT_SETTINGS;
      const partial = { colorMode: 'dark' as const, density: 'compact' as const };

      const merged = mergeSettings(current, partial);

      expect(merged.colorMode).toBe('dark');
      expect(merged.density).toBe('compact');
      expect(merged.fontSize).toBe(current.fontSize); // unchanged
      expect(merged.lastModified).toBeGreaterThan(current.lastModified);
    });

    it('updates lastModified timestamp', () => {
      const current = { ...DEFAULT_SETTINGS, lastModified: 1000 };
      const merged = mergeSettings(current, { fontSize: 'large' });

      expect(merged.lastModified).toBeGreaterThan(1000);
    });

    it('handles empty partial updates', () => {
      const current = DEFAULT_SETTINGS;
      const merged = mergeSettings(current, {});

      expect(merged.colorMode).toBe(current.colorMode);
      expect(merged.density).toBe(current.density);
      expect(merged.lastModified).toBeGreaterThan(current.lastModified);
    });
  });
});
