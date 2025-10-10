import { isSchedulesFeatureEnabled, type EnvRecord } from '../lib/env';
import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';

export type FeatureFlagSnapshot = {
  schedules: boolean;
};

export const resolveFeatureFlags = (envOverride?: EnvRecord): FeatureFlagSnapshot => ({
  schedules: isSchedulesFeatureEnabled(envOverride),
});

const initialSnapshot = resolveFeatureFlags();

let currentSnapshot = initialSnapshot;

export const featureFlags: FeatureFlagSnapshot = initialSnapshot;

export const getFeatureFlags = (envOverride?: EnvRecord): FeatureFlagSnapshot => {
  if (envOverride) {
    return resolveFeatureFlags(envOverride);
  }
  return currentSnapshot;
};

export const FeatureFlagsContext = createContext<FeatureFlagSnapshot>(initialSnapshot);

export type FeatureFlagsProviderProps = {
  value?: FeatureFlagSnapshot;
  children: ReactNode;
};

export const FeatureFlagsProvider: React.FC<FeatureFlagsProviderProps> = ({ value, children }) => {
  const snapshot = value ?? initialSnapshot;
  const memoized = useMemo(() => {
    currentSnapshot = snapshot;
    return snapshot;
  }, [snapshot]);

  return createElement(FeatureFlagsContext.Provider, { value: memoized }, children);
};

export const useFeatureFlags = (): FeatureFlagSnapshot => useContext(FeatureFlagsContext);

export const useFeatureFlag = (flag: keyof FeatureFlagSnapshot): boolean => {
  const flags = useFeatureFlags();
  return flags[flag];
};
