/**
 * useSettings hook unit tests
 * - Functional setState (stale closure prevention)
 * - localStorage persistence
 * - reset functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSettings } from '../useSettings';
import { SETTINGS_STORAGE_KEY, DEFAULT_SETTINGS } from '../settingsModel';

describe('useSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('initializes with defaults', () => {
    const { result } = renderHook(() => useSettings());

    // isLoaded is set true after useEffect runs
    // Settings are loaded from localStorage (defaults if empty)
    expect(result.current.isLoaded).toBe(true);
    expect(result.current.settings.colorMode).toBe(
      DEFAULT_SETTINGS.colorMode
    );
    expect(result.current.settings.density).toBe(DEFAULT_SETTINGS.density);
  });

  it('loads from localStorage on mount', () => {
    const stored = {
      ...DEFAULT_SETTINGS,
      colorMode: 'dark' as const,
      density: 'compact' as const,
    };
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(stored));

    const { result } = renderHook(() => useSettings());

    expect(result.current.settings.colorMode).toBe('dark');
    expect(result.current.settings.density).toBe('compact');
  });

  it('updates settings with partial object (object updater)', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSettings({ colorMode: 'dark' });
    });

    expect(result.current.settings.colorMode).toBe('dark');
    expect(result.current.settings.density).toBe(DEFAULT_SETTINGS.density);
  });

  it('updates settings with functional updater (prevents stale closure)', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSettings((prev) => ({
        ...prev,
        colorMode: 'dark',
        fontSize: 'large',
      }));
    });

    expect(result.current.settings.colorMode).toBe('dark');
    expect(result.current.settings.fontSize).toBe('large');
  });

  it('persists updates to localStorage', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      result.current.updateSettings({ colorMode: 'dark' });
    });

    const stored = JSON.parse(
      localStorage.getItem(SETTINGS_STORAGE_KEY)!
    );
    expect(stored.colorMode).toBe('dark');
  });

  it('resets all settings to defaults', () => {
    const { result } = renderHook(() => useSettings());

    // Update to non-default
    act(() => {
      result.current.updateSettings({
        colorMode: 'dark',
        density: 'compact',
        fontSize: 'large',
      });
    });

    expect(result.current.settings.colorMode).toBe('dark');

    // Reset
    act(() => {
      result.current.resetSettings();
    });

    expect(result.current.settings).toEqual(DEFAULT_SETTINGS);
  });

  it('handles rapid sequential updates (concurrent safety)', () => {
    const { result } = renderHook(() => useSettings());

    act(() => {
      // Simulate rapid updates
      result.current.updateSettings({ colorMode: 'dark' });
      result.current.updateSettings({ fontSize: 'large' });
      result.current.updateSettings({ density: 'compact' });
    });

    // All updates should be present (functional setState prevents loss)
    expect(result.current.settings.colorMode).toBe('dark');
    expect(result.current.settings.fontSize).toBe('large');
    expect(result.current.settings.density).toBe('compact');
  });

  it('sets isLoaded flag after mount', () => {
    const { result } = renderHook(() => useSettings());

    // useEffect runs synchronously in test environment
    expect(result.current.isLoaded).toBe(true);
  });

  it('updateSettings is stable across renders', () => {
    const { result, rerender } = renderHook(() => useSettings());

    const updateFunc1 = result.current.updateSettings;

    act(() => {
      result.current.updateSettings({ colorMode: 'dark' });
    });

    rerender();

    const updateFunc2 = result.current.updateSettings;

    // updateSettings should be stable (useCallback dependency = [])
    expect(updateFunc1).toBe(updateFunc2);
  });
});
