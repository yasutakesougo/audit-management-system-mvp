/**
 * SettingsModel unit tests
 * - localStorage persistence
 * - schema validation
 * - defaults fallback
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    DEFAULT_SETTINGS,
    NAV_POLICY_VERSION,
    loadSettingsFromStorage,
    mergeSettings,
    saveSettingsToStorage,
    SETTINGS_STORAGE_KEY,
    type UserSettings,
} from '../settingsModel';

// Global mock to prevent environment clobbering in these tests
const store: Record<string, string> = {};
const localVault = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, value: string) => { store[key] = String(value); },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { for (const k in store) delete store[k]; },
  key: (i: number) => Object.keys(store)[i] || null,
  get length() { return Object.keys(store).length; },
};

// Also apply to globalThis for settingsModel.ts which uses it
(globalThis as unknown as { localStorage: Storage }).localStorage = localVault;

describe('settingsModel', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: Storage }).localStorage = localVault;
    localVault.clear();
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
        hiddenNavGroups: [],
        navGroupVisibilityPrefs: {},
        hiddenNavItems: [],
        navPolicyVersion: NAV_POLICY_VERSION,
        lastModified: 1234567890,
      };
      localVault.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));

      const loaded = loadSettingsFromStorage();
      expect(loaded.colorMode).toBe('dark');
      expect(loaded.density).toBe('compact');
      expect(loaded.fontSize).toBe('large');
    });

    it('returns defaults when JSON is invalid', () => {
      localVault.setItem(SETTINGS_STORAGE_KEY, 'invalid json {');
      const loaded = loadSettingsFromStorage();
      expect(loaded).toEqual(DEFAULT_SETTINGS);
    });

    it('returns defaults when schema is incomplete', () => {
      const invalid = { colorMode: 'dark' }; // missing required fields
      localVault.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(invalid));
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
      localVault.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(partial));

      const loaded = loadSettingsFromStorage();
      expect(loaded.colorPreset).toBe('default');
    });

    it('loads kiosk layoutMode correctly', () => {
      const settings: UserSettings = {
        colorMode: 'light',
        density: 'comfortable',
        fontSize: 'medium',
        colorPreset: 'default',
        layoutMode: 'kiosk',
        hiddenNavGroups: [],
        navGroupVisibilityPrefs: {},
        hiddenNavItems: [],
        navPolicyVersion: NAV_POLICY_VERSION,
        lastModified: Date.now(),
      };
      localVault.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));

      const loaded = loadSettingsFromStorage();
      expect(loaded.layoutMode).toBe('kiosk');
    });

    it('falls back to normal for unknown layoutMode values', () => {
      const settings = {
        colorMode: 'light',
        density: 'comfortable',
        fontSize: 'medium',
        layoutMode: 'unknown_mode',
        lastModified: Date.now(),
      };
      localVault.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));

      const loaded = loadSettingsFromStorage();
      expect(loaded.layoutMode).toBe('normal');
    });

    it('migrates unset planning visibility to initial ON once', () => {
      const legacy = {
        colorMode: 'light',
        density: 'comfortable',
        fontSize: 'medium',
        colorPreset: 'default',
        layoutMode: 'normal',
        hiddenNavGroups: [],
        hiddenNavItems: [],
        lastModified: 1,
      };
      localVault.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(legacy));

      const loaded = loadSettingsFromStorage();
      expect(loaded.hiddenNavGroups).not.toContain('planning');
      expect(loaded.navGroupVisibilityPrefs.planning).toBe('show');
      expect(loaded.navPolicyVersion).toBe(NAV_POLICY_VERSION);

      const saved = JSON.parse(localVault.getItem(SETTINGS_STORAGE_KEY)!);
      expect(saved.navGroupVisibilityPrefs?.planning).toBe('show');
      expect(saved.navPolicyVersion).toBe(NAV_POLICY_VERSION);
    });

    it('preserves explicit OFF state for planning on migration', () => {
      const legacy = {
        colorMode: 'light',
        density: 'comfortable',
        fontSize: 'medium',
        colorPreset: 'default',
        layoutMode: 'normal',
        hiddenNavGroups: ['planning'],
        hiddenNavItems: [],
        lastModified: 1,
      };
      localVault.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(legacy));

      const loaded = loadSettingsFromStorage();
      expect(loaded.hiddenNavGroups).toContain('planning');
      expect(loaded.navGroupVisibilityPrefs.planning).toBe('hide');
      expect(loaded.navPolicyVersion).toBe(NAV_POLICY_VERSION);
    });

    it('respects explicit planning show/hide preferences over hiddenNavGroups inconsistencies', () => {
      const inconsistentShow = {
        colorMode: 'light',
        density: 'comfortable',
        fontSize: 'medium',
        colorPreset: 'default',
        layoutMode: 'normal',
        hiddenNavGroups: ['planning'],
        navGroupVisibilityPrefs: { planning: 'show' },
        hiddenNavItems: [],
        navPolicyVersion: NAV_POLICY_VERSION,
        lastModified: 1,
      };
      localVault.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(inconsistentShow));
      const loadedShow = loadSettingsFromStorage();
      expect(loadedShow.hiddenNavGroups).not.toContain('planning');
      expect(loadedShow.navGroupVisibilityPrefs.planning).toBe('show');

      const inconsistentHide = {
        ...inconsistentShow,
        hiddenNavGroups: [],
        navGroupVisibilityPrefs: { planning: 'hide' },
      };
      localVault.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(inconsistentHide));
      const loadedHide = loadSettingsFromStorage();
      expect(loadedHide.hiddenNavGroups).toContain('planning');
      expect(loadedHide.navGroupVisibilityPrefs.planning).toBe('hide');
    });

    it('does not reapply planning migration when navPolicyVersion is current', () => {
      const current = {
        colorMode: 'light',
        density: 'comfortable',
        fontSize: 'medium',
        colorPreset: 'default',
        layoutMode: 'normal',
        hiddenNavGroups: [],
        navGroupVisibilityPrefs: {},
        hiddenNavItems: [],
        navPolicyVersion: NAV_POLICY_VERSION,
        lastModified: 1234567890,
      };
      localVault.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(current));
      const before = localVault.getItem(SETTINGS_STORAGE_KEY);

      const loaded = loadSettingsFromStorage();

      expect(loaded.navPolicyVersion).toBe(NAV_POLICY_VERSION);
      expect(loaded.navGroupVisibilityPrefs.planning).toBeUndefined();
      expect(loaded.lastModified).toBe(1234567890);
      expect(localVault.getItem(SETTINGS_STORAGE_KEY)).toBe(before);
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
        hiddenNavGroups: [],
        navGroupVisibilityPrefs: {},
        hiddenNavItems: [],
        navPolicyVersion: NAV_POLICY_VERSION,
        lastModified: 1234567890,
      };

      const result = saveSettingsToStorage(settings);
      expect(result).toBe(true);

      const stored = localVault.getItem(SETTINGS_STORAGE_KEY);
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
        localVault.getItem(SETTINGS_STORAGE_KEY)!
      );
      expect(stored.lastModified).toBeGreaterThanOrEqual(before);
      expect(stored.lastModified).toBeLessThanOrEqual(after);
    });

    it('returns true on success', () => {
      const result = saveSettingsToStorage(DEFAULT_SETTINGS);
      expect(result).toBe(true);
    });

    it('returns false gracefully on quota exceeded', () => {
      // Stub the instance method directly to avoid prototype issues
      const originalSetItem = localVault.setItem;
      localVault.setItem = () => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      };

      const result = saveSettingsToStorage(DEFAULT_SETTINGS);
      expect(result).toBe(false);

      localVault.setItem = originalSetItem;
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
