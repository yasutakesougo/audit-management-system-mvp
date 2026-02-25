/**
 * Settings Model - User display preferences
 * Supports: dark mode, density, font size, color customization
 * Persisted to localStorage for session continuity
 */

/** User display preferences */
export type UserSettings = {
  // Theme
  colorMode: 'light' | 'dark' | 'system';

  // Layout density
  density: 'compact' | 'comfortable' | 'spacious';

  // Typography
  fontSize: 'small' | 'medium' | 'large';

  // Color presets (Phase 2+)
  colorPreset: 'default' | 'highContrast' | 'custom';

  // Layout mode (Phase 6: Focus Mode)
  layoutMode: 'normal' | 'focus';

  // Timestamp for sync validation
  lastModified: number;
};

/** Default settings - matches UI Baseline */
export const DEFAULT_SETTINGS: UserSettings = {
  colorMode: 'system',
  density: 'comfortable',
  fontSize: 'medium',
  colorPreset: 'default',
  layoutMode: 'normal',
  lastModified: Date.now(),
};

/** localStorage key */
export const SETTINGS_STORAGE_KEY = 'audit:settings:v1';

/**
 * Load settings from localStorage with fallback
 * - Validates schema on load
 * - Returns defaults if corrupted/missing
 */
export function loadSettingsFromStorage(): UserSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;

    const parsed = JSON.parse(stored);

    // Validate required fields
    if (
      typeof parsed.colorMode !== 'string' ||
      typeof parsed.density !== 'string' ||
      typeof parsed.fontSize !== 'string'
    ) {
      console.warn('[settings] Invalid schema, using defaults');
      return DEFAULT_SETTINGS;
    }

    return {
      colorMode: parsed.colorMode as UserSettings['colorMode'],
      density: parsed.density as UserSettings['density'],
      fontSize: parsed.fontSize as UserSettings['fontSize'],
      colorPreset: parsed.colorPreset || 'default',
      layoutMode: parsed.layoutMode || 'normal',
      lastModified: parsed.lastModified || Date.now(),
    };
  } catch (error) {
    console.error('[settings] Parse error, using defaults:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Save settings to localStorage
 * - Silent fail on quota exceeded (graceful degradation)
 * - Updates lastModified timestamp
 */
export function saveSettingsToStorage(settings: UserSettings): boolean {
  try {
    const toSave = {
      ...settings,
      lastModified: Date.now(),
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(toSave));
    return true;
  } catch (error) {
    if (
      (error instanceof DOMException && (error.code === 22 || error.name === 'QuotaExceededError')) ||
      (error instanceof Error && error.name === 'QuotaExceededError')
    ) {
      console.warn('[settings] localStorage quota exceeded, skipping save');
      return false;
    }
    console.error('[settings] Save error:', error);
    return false;
  }
}

/**
 * Merge partial settings with current state
 * Preserves unmodified fields
 */
export function mergeSettings(
  current: UserSettings,
  partial: Partial<UserSettings>
): UserSettings {
  return {
    ...current,
    ...partial,
    lastModified: Date.now(),
  };
}
