import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppTheme } from '../useAppTheme';
import { SettingsProvider } from '@/features/settings/SettingsContext';
import * as themeModule from '@/app/theme';

const SettingsWrapper = ({ children }: { children: React.ReactNode }) => (
  React.createElement(SettingsProvider, null, children)
);

describe('useAppTheme', () => {
  let applySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    applySpy = vi.spyOn(themeModule, 'applyDensityToDocument').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a theme instance with spacing function', () => {
    const { result } = renderHook(() => useAppTheme(), {
      wrapper: SettingsWrapper,
    });

    expect(result.current).toBeTruthy();
    expect(typeof result.current.spacing).toBe('function');
  });

  it('calls applyDensityToDocument on mount', () => {
    renderHook(() => useAppTheme(), {
      wrapper: SettingsWrapper,
    });

    expect(applySpy).toHaveBeenCalled();
  });

  it('theme spacing returns px formatted string', () => {
    const { result } = renderHook(() => useAppTheme(), {
      wrapper: SettingsWrapper,
    });

    const spacing = result.current.spacing(1);
    expect(typeof spacing).toBe('string');
    // Check that it ends with px
    expect(spacing.endsWith('px')).toBe(true);
  });

  it('theme has components property', () => {
    const { result } = renderHook(() => useAppTheme(), {
      wrapper: SettingsWrapper,
    });

    expect(result.current.components).toBeDefined();
  });
});
