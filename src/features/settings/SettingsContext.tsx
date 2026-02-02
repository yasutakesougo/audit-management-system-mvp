/**
 * SettingsContext & SettingsProvider
 *
 * Provides settings state to entire app tree.
 * Allows descendant components to access & update user preferences without prop drilling.
 */

import React, { createContext, useMemo } from 'react';
import type { UserSettings } from './settingsModel';
import { useSettings } from './useSettings';

interface SettingsContextType {
  settings: UserSettings;
  updateSettings: (
    partial: Partial<UserSettings> | ((prev: UserSettings) => UserSettings)
  ) => void;
  resetSettings: () => void;
  isLoaded: boolean;
}

export const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined
);

interface SettingsProviderProps {
  children: React.ReactNode;
}

/**
 * SettingsProvider component
 *
 * Wraps app tree to provide settings context.
 * Should be placed near root, before ColorModeContext consumer.
 *
 * Example:
 * ```tsx
 * <SettingsProvider>
 *   <App />
 * </SettingsProvider>
 * ```
 */
export function SettingsProvider({ children }: SettingsProviderProps) {
  const { settings, updateSettings, resetSettings, isLoaded } = useSettings();

  const value = useMemo(
    () => ({
      settings,
      updateSettings,
      resetSettings,
      isLoaded,
    }),
    [settings, updateSettings, resetSettings, isLoaded]
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

/**
 * useSettingsContext hook
 *
 * Access settings context in descendant components.
 * Throws error if used outside SettingsProvider.
 *
 * Example:
 * ```tsx
 * function MyComponent() {
 *   const { settings, updateSettings } = useSettingsContext();
 *   return <button onClick={() => updateSettings({ colorMode: 'dark' })}>...</button>;
 * }
 * ```
 */
export function useSettingsContext(): SettingsContextType {
  const context = React.useContext(SettingsContext);
  if (!context) {
    throw new Error(
      'useSettingsContext must be used within SettingsProvider'
    );
  }
  return context;
}
