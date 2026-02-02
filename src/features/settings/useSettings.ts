/**
 * useSettings Hook
 *
 * Manages user display preferences with localStorage persistence.
 * Uses functional setState to prevent stale closure in React 18 concurrent updates.
 *
 * Example:
 * ```tsx
 * const { settings, updateSettings, resetSettings } = useSettings();
 *
 * // Update single field
 * updateSettings({ colorMode: 'dark' });
 *
 * // Reset to defaults
 * resetSettings();
 * ```
 */

import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_SETTINGS,
  loadSettingsFromStorage,
  mergeSettings,
  saveSettingsToStorage,
  type UserSettings,
} from './settingsModel';

type SettingsUpdater = (prev: UserSettings) => UserSettings;

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize from localStorage on mount
  useEffect(() => {
    const loaded = loadSettingsFromStorage();
    setSettings(loaded);
    setIsLoaded(true);
  }, []);

  /**
   * Update settings with partial changes
   *
   * Uses functional setState to handle React 18 concurrent updates safely.
   * Prevents stale closure issues when multiple updates occur rapidly.
   */
  const updateSettings = useCallback(
    (
      partialOrUpdater:
        | Partial<UserSettings>
        | SettingsUpdater
    ) => {
      setSettings((prev) => {
        let updated: UserSettings;

        if (typeof partialOrUpdater === 'function') {
          // Functional updater
          updated = partialOrUpdater(prev);
        } else {
          // Partial object - merge with current state
          updated = mergeSettings(prev, partialOrUpdater);
        }

        // Persist to localStorage
        saveSettingsToStorage(updated);

        return updated;
      });
    },
    []
  );

  /**
   * Reset all settings to defaults
   */
  const resetSettings = useCallback(() => {
    setSettings(() => {
      saveSettingsToStorage(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    });
  }, []);

  return {
    settings,
    updateSettings,
    resetSettings,
    isLoaded,
  };
}
