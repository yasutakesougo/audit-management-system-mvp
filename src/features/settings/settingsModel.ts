/**
 * Settings Model - User display preferences
 * Supports: dark mode, density, font size, color customization, nav visibility
 * Persisted to localStorage for session continuity
 */

import {
  NAV_GROUP_ORDER,
  type NavGroupKey,
} from '@/app/config/navigationConfig.types';

export type NavGroupVisibilityPreference = 'show' | 'hide';
export type NavGroupVisibilityPreferences = Partial<
  Record<NavGroupKey, NavGroupVisibilityPreference>
>;

export const NAV_POLICY_VERSION = 1;

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

  // Layout mode (Phase 6: Focus Mode / Phase 10: Kiosk Mode)
  layoutMode: 'normal' | 'focus' | 'kiosk';

  // Hidden navigation groups (sidebar menu visibility)
  hiddenNavGroups: NavGroupKey[];

  // Explicit group-level visibility preferences (used for migration safety)
  navGroupVisibilityPrefs: NavGroupVisibilityPreferences;

  // Hidden individual navigation items (by path)
  hiddenNavItems: string[];

  // Settings migration version for navigation policy changes
  navPolicyVersion: number;

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
  hiddenNavGroups: [],
  navGroupVisibilityPrefs: {},
  hiddenNavItems: [],
  navPolicyVersion: NAV_POLICY_VERSION,
  lastModified: Date.now(),
};

/** localStorage key */
export const SETTINGS_STORAGE_KEY = 'audit:settings:v1';

const NAV_GROUP_KEY_SET: ReadonlySet<NavGroupKey> = new Set(NAV_GROUP_ORDER);

function isNavGroupKey(value: unknown): value is NavGroupKey {
  return typeof value === 'string' && NAV_GROUP_KEY_SET.has(value as NavGroupKey);
}

function parseHiddenNavGroups(raw: unknown): NavGroupKey[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((group): group is NavGroupKey => isNavGroupKey(group));
}

function parseHiddenNavItems(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === 'string');
}

function parseNavGroupVisibilityPrefs(raw: unknown): NavGroupVisibilityPreferences {
  if (!raw || typeof raw !== 'object') return {};
  const prefs: NavGroupVisibilityPreferences = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isNavGroupKey(key)) continue;
    if (value === 'show' || value === 'hide') {
      prefs[key] = value;
    }
  }
  return prefs;
}

function applyPlanningPreferenceConsistency(
  hiddenNavGroups: NavGroupKey[],
  navGroupVisibilityPrefs: NavGroupVisibilityPreferences,
): NavGroupKey[] {
  const planningPref = navGroupVisibilityPrefs.planning;
  const planningHidden = hiddenNavGroups.includes('planning');
  if (planningPref === 'hide' && !planningHidden) {
    return [...hiddenNavGroups, 'planning'];
  }
  if (planningPref === 'show' && planningHidden) {
    return hiddenNavGroups.filter((group) => group !== 'planning');
  }
  return hiddenNavGroups;
}

function migratePlanningInitialOn(settings: UserSettings): {
  migrated: UserSettings;
  didMutate: boolean;
} {
  const hasPlanningPreference = settings.navGroupVisibilityPrefs.planning !== undefined;
  let nextHiddenGroups = settings.hiddenNavGroups;
  let nextPrefs = settings.navGroupVisibilityPrefs;
  let didMutate = false;

  // B案 migration:
  // - planning preference unset users only
  // - preserve existing explicit OFF (hiddenNavGroups includes planning)
  if (settings.navPolicyVersion < NAV_POLICY_VERSION && !hasPlanningPreference) {
    const isPlanningHidden = settings.hiddenNavGroups.includes('planning');
    nextPrefs = {
      ...settings.navGroupVisibilityPrefs,
      planning: isPlanningHidden ? 'hide' : 'show',
    };
    nextHiddenGroups = isPlanningHidden
      ? settings.hiddenNavGroups
      : settings.hiddenNavGroups.filter((group) => group !== 'planning');
    didMutate = true;
  }

  const consistentHiddenGroups = applyPlanningPreferenceConsistency(
    nextHiddenGroups,
    nextPrefs,
  );
  if (consistentHiddenGroups !== nextHiddenGroups) {
    didMutate = true;
  }

  const migrated: UserSettings = {
    ...settings,
    hiddenNavGroups: consistentHiddenGroups,
    navGroupVisibilityPrefs: nextPrefs,
    navPolicyVersion:
      settings.navPolicyVersion < NAV_POLICY_VERSION
        ? NAV_POLICY_VERSION
        : settings.navPolicyVersion,
    lastModified: didMutate ? Date.now() : settings.lastModified,
  };

  if (settings.navPolicyVersion < NAV_POLICY_VERSION) {
    didMutate = true;
  }

  return { migrated, didMutate };
}

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

    const loaded: UserSettings = {
      colorMode: parsed.colorMode as UserSettings['colorMode'],
      density: parsed.density as UserSettings['density'],
      fontSize: parsed.fontSize as UserSettings['fontSize'],
      colorPreset: parsed.colorPreset || 'default',
      layoutMode: (['normal', 'focus', 'kiosk'] as const).includes(parsed.layoutMode)
        ? parsed.layoutMode
        : 'normal',
      hiddenNavGroups: parseHiddenNavGroups(parsed.hiddenNavGroups),
      navGroupVisibilityPrefs: parseNavGroupVisibilityPrefs(parsed.navGroupVisibilityPrefs),
      hiddenNavItems: parseHiddenNavItems(parsed.hiddenNavItems),
      navPolicyVersion:
        typeof parsed.navPolicyVersion === 'number' ? parsed.navPolicyVersion : 0,
      lastModified: parsed.lastModified || Date.now(),
    };

    const { migrated, didMutate } = migratePlanningInitialOn(loaded);
    if (didMutate) {
      saveSettingsToStorage(migrated);
    }

    return migrated;
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
