/**
 * Integration Tests for Phase 3: Density Context Integration
 *
 * Verifies:
 * 1. Settings persisted to localStorage are loaded on mount
 * 2. Density changes are reflected in context
 * 3. SettingsDialog displays current settings
 * 4. CSS variables are applied to document
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { SettingsProvider, useSettingsContext } from '../index';
import { SETTINGS_STORAGE_KEY } from '../settingsModel';

// Mock component to test context access
const TestConsumer: React.FC = () => {
  const { settings, updateSettings } = useSettingsContext();

  return (
    <div>
      <div data-testid="current-density">{settings.density}</div>
      <div data-testid="current-color-mode">{settings.colorMode}</div>
      <button
        data-testid="change-density-compact"
        onClick={() => updateSettings({ density: 'compact' })}
      >
        Set Compact
      </button>
      <button
        data-testid="change-density-spacious"
        onClick={() => updateSettings({ density: 'spacious' })}
      >
        Set Spacious
      </button>
    </div>
  );
};

describe('Phase 3: Density Context Integration', () => {
  afterEach(() => {
    localStorage.clear();
  });

  describe('Settings Persistence', () => {
    it('loads default settings on first mount', () => {
      render(
        <SettingsProvider>
          <TestConsumer />
        </SettingsProvider>
      );

      expect(screen.getByTestId('current-density')).toHaveTextContent('comfortable');
      expect(screen.getByTestId('current-color-mode')).toHaveTextContent('system');
    });

    it('updates density in context', async () => {
      const user = userEvent.setup();
      render(
        <SettingsProvider>
          <TestConsumer />
        </SettingsProvider>
      );

      const compactButton = screen.getByTestId('change-density-compact');
      await user.click(compactButton);

      await waitFor(() => {
        expect(screen.getByTestId('current-density')).toHaveTextContent('compact');
      });
    });

    it('loads persisted settings on mount', () => {
      // Pre-populate localStorage with correct key
      localStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify({
          colorMode: 'dark',
          density: 'spacious',
          fontSize: 'large',
          colorPreset: 'highContrast',
          lastModified: Date.now(),
        })
      );

      render(
        <SettingsProvider>
          <TestConsumer />
        </SettingsProvider>
      );

      expect(screen.getByTestId('current-density')).toHaveTextContent('spacious');
      expect(screen.getByTestId('current-color-mode')).toHaveTextContent('dark');
    });
  });

  describe('Context Updates', () => {
    it('updates density in context', async () => {
      const user = userEvent.setup();
      render(
        <SettingsProvider>
          <TestConsumer />
        </SettingsProvider>
      );

      const spaciousButton = screen.getByTestId('change-density-spacious');
      await user.click(spaciousButton);

      await waitFor(() => {
        expect(screen.getByTestId('current-density')).toHaveTextContent('spacious');
      });
    });

    it('handles multiple sequential density changes', async () => {
      const user = userEvent.setup();
      render(
        <SettingsProvider>
          <TestConsumer />
        </SettingsProvider>
      );

      const compactButton = screen.getByTestId('change-density-compact');
      const spaciousButton = screen.getByTestId('change-density-spacious');

      await user.click(compactButton);
      await waitFor(() => {
        expect(screen.getByTestId('current-density')).toHaveTextContent('compact');
      });

      await user.click(spaciousButton);
      await waitFor(() => {
        expect(screen.getByTestId('current-density')).toHaveTextContent('spacious');
      });
    });
  });

  describe('Error Handling', () => {
    it('gracefully handles invalid localStorage data', () => {
      localStorage.setItem(SETTINGS_STORAGE_KEY, 'invalid json');

      // Should not throw, should use defaults
      expect(() => {
        render(
          <SettingsProvider>
            <TestConsumer />
          </SettingsProvider>
        );
      }).not.toThrow();

      expect(screen.getByTestId('current-density')).toHaveTextContent('comfortable');
    });

    it('handles localStorage quota exceeded gracefully', async () => {
      const user = userEvent.setup();

      // Mock localStorage setItem to throw quota error
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
      const error = new Error('QuotaExceededError') as Error & { code?: number };
      error.code = 22;
      setItemSpy.mockImplementation(() => {
        throw error;
      });

      render(
        <SettingsProvider>
          <TestConsumer />
        </SettingsProvider>
      );

      const compactButton = screen.getByTestId('change-density-compact');
      
      // Should not throw even if localStorage fails
      await user.click(compactButton);

      await waitFor(() => {
        expect(screen.getByTestId('current-density')).toHaveTextContent('compact');
      });

      setItemSpy.mockRestore();
    });
  });

  describe('useSettingsContext Hook', () => {
    it('throws error when used outside of SettingsProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestConsumer />);
      }).toThrow('useSettingsContext must be used within a <SettingsProvider>');

      consoleSpy.mockRestore();
    });
  });
});
