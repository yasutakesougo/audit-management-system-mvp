import { isE2E } from '@/env';
import { createContext, createElement, useContext, useMemo, type FC, type ReactNode } from 'react';
import {
    isComplianceFormEnabled,
  isIcebergPdcaEnabled,
    isSchedulesFeatureEnabled,
    isSchedulesWeekV2Enabled,
    isTestMode,
    readBool,
    readOptionalEnv,
    type EnvRecord,
} from '../lib/env';

export type FeatureFlagSnapshot = {
  schedules: boolean;
  complianceForm: boolean;
  schedulesWeekV2: boolean;
  icebergPdca: boolean;
};

const _hasExplicitOverride = (storageKey: string, envKey: string, envOverride?: EnvRecord): boolean => {
  // env override takes priority when provided
  if (typeof envOverride !== 'undefined' && envKey in envOverride) {
    return true;
  }

  // process/global env
  if (typeof process !== 'undefined' && process.env && envKey in process.env) {
    return true;
  }

  // runtime env shim (window.__ENV__)
  if (typeof window !== 'undefined') {
    const runtimeEnv = (window as Window & { __ENV__?: Record<string, string | undefined> }).__ENV__;
    if (runtimeEnv && envKey in runtimeEnv) {
      return true;
    }

    try {
      if (window.localStorage.getItem(storageKey) != null) {
        return true;
      }
    } catch {
      // ignore storage access errors (private mode, etc.)
    }
  }

  return false;
};

const isAutomationRuntime = (): boolean => {
  if (typeof navigator !== 'undefined' && navigator.webdriver) {
    return true;
  }
  if (typeof window !== 'undefined') {
    const automationHints = window as Window & { __PLAYWRIGHT__?: unknown; Cypress?: unknown };
    if (automationHints.__PLAYWRIGHT__ || automationHints.Cypress) {
      return true;
    }
  }
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.VITEST === '1' || process.env.PLAYWRIGHT_TEST === '1') {
      return true;
    }
  }
  return false;
};

/**
 * Check if an environment variable explicitly contains a boolean-like value.
 * Only returns true for actual boolean representations: '1', '0', 'true', 'false'.
 * Empty strings and undefined are treated as "not explicitly set".
 *
 * IMPORTANT: When envOverride is provided, only consider values from envOverride.
 * This prevents local/process env from leaking into automation-specific overrides.
 */
const hasExplicitBoolEnv = (key: string, envOverride?: EnvRecord): boolean => {
  if (envOverride) {
    const rawOverride = envOverride[key];
    if (rawOverride === undefined || rawOverride === null) return false;
    const v = String(rawOverride).trim().toLowerCase();
    return v === '1' || v === '0' || v === 'true' || v === 'false';
  }
  const raw = readOptionalEnv(key);
  if (raw == null) return false;
  const v = raw.trim().toLowerCase();
  return v === '1' || v === '0' || v === 'true' || v === 'false';
};

export const resolveFeatureFlags = (envOverride?: EnvRecord): FeatureFlagSnapshot => {
  // Treat explicit envOverride as an automation-like context to apply safe defaults
  const isAutomationEnv = envOverride ? true : (isE2E || isTestMode(envOverride) || isAutomationRuntime());

  const baseSnapshot: FeatureFlagSnapshot = {
    schedules: isSchedulesFeatureEnabled(envOverride),
    complianceForm: isComplianceFormEnabled(envOverride),
    schedulesWeekV2: isSchedulesWeekV2Enabled(envOverride),
    icebergPdca: isIcebergPdcaEnabled(envOverride),
  };

  const explicitSchedules = hasExplicitBoolEnv('VITE_FEATURE_SCHEDULES', envOverride);
  const explicitIcebergPdca = hasExplicitBoolEnv('VITE_FEATURE_ICEBERG_PDCA', envOverride);

  if (isAutomationEnv) {
    // In automation, honor explicit env overrides when provided (needed for flag-off E2E scenarios).
    // If no explicit override, default to true for schedules, and default PDCA off.
    const schedules = explicitSchedules ? readBool('VITE_FEATURE_SCHEDULES', true, envOverride) : true;
    const icebergPdca = explicitIcebergPdca ? readBool('VITE_FEATURE_ICEBERG_PDCA', false, envOverride) : false;
    return {
      ...baseSnapshot,
      schedules,
      icebergPdca,
    };
  }

  return baseSnapshot;
};

const initialSnapshot = resolveFeatureFlags();

let currentSnapshot = initialSnapshot;

/**
 * 初期ビルド時の機能フラグスナップショット（参照用）
 * 注意: これは初期値固定です。最新の状態は getFeatureFlags() を使用してください。
 */
export const featureFlags: FeatureFlagSnapshot = initialSnapshot;

/**
 * 機能フラグの現在の状態を取得
 * @param envOverride 環境変数のオーバーライド（テスト時などに使用）
 * @returns 現在の機能フラグスナップショット
 */
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

export const FeatureFlagsProvider: FC<FeatureFlagsProviderProps> = ({ value, children }) => {
  // value が未指定の場合は現在の環境から自動再計算（テストやE2E環境での柔軟性向上）
  const snapshot = value ?? resolveFeatureFlags();

  // 各フラグの変更を個別に検出してメモ化を最適化
  const memoized = useMemo(() => {
    currentSnapshot = snapshot;
    return snapshot;
  }, [snapshot.schedules, snapshot.complianceForm, snapshot.schedulesWeekV2, snapshot.icebergPdca]);

  return createElement(FeatureFlagsContext.Provider, { value: memoized }, children);
};

export const useFeatureFlags = (): FeatureFlagSnapshot => useContext(FeatureFlagsContext);

export const useFeatureFlag = (flag: keyof FeatureFlagSnapshot): boolean => {
  const flags = useFeatureFlags();
  return flags[flag];
};

/**
 * テスト用のリセット関数
 * currentSnapshot をデフォルト状態に戻し、テスト間の影響を排除
 */
export const __resetFeatureFlagsForTest = (): void => {
  currentSnapshot = initialSnapshot;
};
