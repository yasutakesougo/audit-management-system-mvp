import { isE2E } from '@/env';
import { createContext, createElement, useContext, useMemo, type FC, type ReactNode } from 'react';
import {
  isComplianceFormEnabled,
  isIcebergPdcaEnabled,
  isSchedulesCreateEnabled,
  isSchedulesFeatureEnabled,
  isSchedulesWeekV2Enabled,
  isTestMode,
  type EnvRecord,
} from '../lib/env';

export type FeatureFlagSnapshot = {
  schedules: boolean;
  schedulesCreate: boolean;
  complianceForm: boolean;
  schedulesWeekV2: boolean;
  icebergPdca: boolean;
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

export const resolveFeatureFlags = (envOverride?: EnvRecord): FeatureFlagSnapshot => {
  const baseSnapshot: FeatureFlagSnapshot = {
    schedules: isSchedulesFeatureEnabled(envOverride),
    schedulesCreate: isSchedulesCreateEnabled(envOverride),
    complianceForm: isComplianceFormEnabled(envOverride),
    schedulesWeekV2: isSchedulesWeekV2Enabled(envOverride),
    icebergPdca: isIcebergPdcaEnabled(envOverride),
  };

  if (isE2E || isTestMode(envOverride) || isAutomationRuntime()) {
    return {
      ...baseSnapshot,
      schedules: true,
      schedulesCreate: true,
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
  }, [snapshot.schedules, snapshot.schedulesCreate, snapshot.complianceForm, snapshot.schedulesWeekV2, snapshot.icebergPdca]);

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
