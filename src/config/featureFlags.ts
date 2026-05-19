import { isE2E } from '@/env';
import { createContext, createElement, useContext, useEffect, useMemo, useState, type FC, type ReactNode } from 'react';
import {
    isComplianceFormEnabled,
    isIcebergPdcaEnabled,
    isSchedulesFeatureEnabled,
    isSchedulesWeekV2Enabled,
    isStaffAttendanceEnabled,
    isTodayLiteNavV2FeatureEnabled,
    isTestMode,
    isTodayLiteUiFeatureEnabled,
    isTodayOpsFeatureEnabled,
    readBool,
    readOptionalEnv,
    type EnvRecord,
} from '../lib/env';

// ── Same-tab Reactivity for Direct localStorage Writes ──
const FEATURE_FLAGS_CHANGED_EVENT = 'feature-flags-changed';

interface PatchedStorage {
  __feature_flags_patched__?: boolean;
}

if (typeof window !== 'undefined' && window.localStorage && !(window.localStorage as PatchedStorage).__feature_flags_patched__) {
  try {
    (window.localStorage as PatchedStorage).__feature_flags_patched__ = true;
    const originalSetItem = window.localStorage.setItem;
    const originalRemoveItem = window.localStorage.removeItem;

    window.localStorage.setItem = function (key, value) {
      originalSetItem.call(this, key, value);
      if (key.startsWith('feature:')) {
        window.dispatchEvent(new CustomEvent(FEATURE_FLAGS_CHANGED_EVENT));
      }
    };

    window.localStorage.removeItem = function (key) {
      originalRemoveItem.call(this, key);
      if (key.startsWith('feature:')) {
        window.dispatchEvent(new CustomEvent(FEATURE_FLAGS_CHANGED_EVENT));
      }
    };
  } catch {
    // Ignore issues in environments with restricted localStorage (e.g. sandbox/private mode)
  }
}

// ── Lot1B PR #E — UserBenefit_Profile optional 6-column cutover stage ──
// Single source of truth. Mapper modules must delegate here.
export const USER_BENEFIT_PROFILE_CUTOVER_STAGES = [
  'PRE_MIGRATION',
  'DUAL_WRITE',
  'BACKFILL_IN_PROGRESS',
  'READ_CUTOVER',
  'WRITE_CUTOVER',
] as const;
export type UserBenefitProfileCutoverStage = (typeof USER_BENEFIT_PROFILE_CUTOVER_STAGES)[number];
export const ENV_KEY_USER_BENEFIT_PROFILE_CUTOVER_STAGE = 'VITE_USER_BENEFIT_PROFILE_CUTOVER_STAGE';
export const LOCAL_STORAGE_KEY_USER_BENEFIT_PROFILE_CUTOVER_STAGE = 'lot1b.userBenefitProfileCutoverStage';

const isCutoverStage = (raw: unknown): raw is UserBenefitProfileCutoverStage =>
  typeof raw === 'string' && (USER_BENEFIT_PROFILE_CUTOVER_STAGES as readonly string[]).includes(raw);

export const resolveUserBenefitProfileCutoverStage = (
  envOverride?: EnvRecord,
): UserBenefitProfileCutoverStage => {
  const fromEnv = readOptionalEnv(ENV_KEY_USER_BENEFIT_PROFILE_CUTOVER_STAGE, envOverride);
  if (isCutoverStage(fromEnv)) return fromEnv;

  if (typeof window !== 'undefined') {
    try {
      const ls = window.localStorage?.getItem(LOCAL_STORAGE_KEY_USER_BENEFIT_PROFILE_CUTOVER_STAGE);
      if (isCutoverStage(ls)) return ls;
    } catch {
      // ignore private-mode errors
    }
  }

  return 'PRE_MIGRATION';
};

export type FeatureFlagSnapshot = {
  schedules: boolean;
  complianceForm: boolean;
  schedulesWeekV2: boolean;
  icebergPdca: boolean;
  staffAttendance: boolean;

  todayOps: boolean;
  todayLiteUi: boolean;
  todayLiteNavV2: boolean;
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
    const rawOverride = (envOverride as Record<string, unknown>)[key];
    if (rawOverride === undefined || rawOverride === null) return false;
    const v = String(rawOverride).trim().toLowerCase();
    return v === '1' || v === '0' || v === 'true' || v === 'false';
  }
  const raw = readOptionalEnv(key);
  if (raw == null) return false;
  const v = String(raw).trim().toLowerCase();
  return v === '1' || v === '0' || v === 'true' || v === 'false';
};

const _readLocalStorageFlag = (key: string): boolean | undefined => {
  if (typeof window === 'undefined') return undefined;
  try {
    const flag = window.localStorage.getItem(`feature:${key}`);
    if (flag != null) {
      const normalized = flag.trim().toLowerCase();
      const TRUTHY = new Set(['1', 'true', 'yes', 'y', 'on', 'enabled']);
      const FALSY = new Set(['0', 'false', 'no', 'n', 'off', 'disabled']);
      if (TRUTHY.has(normalized)) return true;
      if (FALSY.has(normalized)) return false;
    }
  } catch {
    // ignore storage access issues
  }
  return undefined;
};

export const resolveFeatureFlags = (envOverride?: EnvRecord): FeatureFlagSnapshot => {
  // Treat explicit envOverride as an automation-like context to apply safe defaults
  const isAutomationEnv = envOverride ? true : (isE2E || isTestMode() || isAutomationRuntime());

  const baseSnapshot: FeatureFlagSnapshot = {
    schedules: isSchedulesFeatureEnabled(envOverride),
    complianceForm: isComplianceFormEnabled(envOverride),
    schedulesWeekV2: isSchedulesWeekV2Enabled(envOverride),
    icebergPdca: isIcebergPdcaEnabled(envOverride),
    staffAttendance: isStaffAttendanceEnabled(envOverride),

    todayOps: isTodayOpsFeatureEnabled(envOverride),
    todayLiteUi: isTodayLiteUiFeatureEnabled(envOverride),
    todayLiteNavV2: isTodayLiteNavV2FeatureEnabled(envOverride),
  };

  const explicitSchedules = hasExplicitBoolEnv('VITE_FEATURE_SCHEDULES', envOverride);
  const explicitIcebergPdca = hasExplicitBoolEnv('VITE_FEATURE_ICEBERG_PDCA', envOverride);
  const explicitStaffAttendance = hasExplicitBoolEnv('VITE_FEATURE_STAFF_ATTENDANCE', envOverride);
  const explicitTodayOps = hasExplicitBoolEnv('VITE_FEATURE_TODAY_OPS', envOverride);
  const explicitTodayLiteUi = hasExplicitBoolEnv('VITE_FEATURE_TODAY_LITE_UI', envOverride);
  const explicitTodayLiteNavV2 = hasExplicitBoolEnv('VITE_FEATURE_TODAY_LITE_NAV_V2', envOverride);

  // Apply environment or localStorage override (with localStorage priority if no env override)
  // If in automation, use specific default values when no explicit overrides are provided.
  const schedules = explicitSchedules
    ? readBool('VITE_FEATURE_SCHEDULES', true, envOverride)
    : (_readLocalStorageFlag('schedules') ?? (isAutomationEnv ? true : baseSnapshot.schedules));

  const icebergPdca = explicitIcebergPdca
    ? readBool('VITE_FEATURE_ICEBERG_PDCA', false, envOverride)
    : (_readLocalStorageFlag('icebergPdca') ?? (isAutomationEnv ? false : baseSnapshot.icebergPdca));

  const staffAttendance = explicitStaffAttendance
    ? readBool('VITE_FEATURE_STAFF_ATTENDANCE', false, envOverride)
    : (_readLocalStorageFlag('staffAttendance') ?? (isAutomationEnv ? true : baseSnapshot.staffAttendance));

  const todayOps = explicitTodayOps
    ? readBool('VITE_FEATURE_TODAY_OPS', false, envOverride)
    : (_readLocalStorageFlag('todayOps') ?? (isAutomationEnv ? true : baseSnapshot.todayOps));

  const todayLiteUi = explicitTodayLiteUi
    ? readBool('VITE_FEATURE_TODAY_LITE_UI', false, envOverride)
    : (_readLocalStorageFlag('todayLiteUi') ?? (isAutomationEnv ? false : baseSnapshot.todayLiteUi));

  const todayLiteNavV2 = explicitTodayLiteNavV2
    ? readBool('VITE_FEATURE_TODAY_LITE_NAV_V2', false, envOverride)
    : (_readLocalStorageFlag('todayLiteNavV2') ?? (isAutomationEnv ? false : baseSnapshot.todayLiteNavV2));

  // Optional: support overrides for complianceForm and schedulesWeekV2 as well
  const complianceForm = _readLocalStorageFlag('complianceForm') ?? baseSnapshot.complianceForm;
  const schedulesWeekV2 = _readLocalStorageFlag('schedulesWeekV2') ?? baseSnapshot.schedulesWeekV2;

  return {
    schedules,
    complianceForm,
    schedulesWeekV2,
    icebergPdca,
    staffAttendance,
    todayOps,
    todayLiteUi,
    todayLiteNavV2,
  };
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
  // 内部 state で管理し、localStorage 変更に reactive に反応する
  const [flags, setFlags] = useState<FeatureFlagSnapshot>(() => value ?? resolveFeatureFlags());

  // props の value が変わったら反映（テスト・E2E 環境での柔軟性維持）
  useEffect(() => {
    if (value) setFlags(value);
  }, [
    // value オブジェクト全体ではなく個別フラグで比較（不要な再レンダリング回避）
    value?.schedules,
    value?.complianceForm,
    value?.schedulesWeekV2,
    value?.icebergPdca,
    value?.staffAttendance,
    value?.todayOps,
    value?.todayLiteUi,
    value?.todayLiteNavV2,
  ]);

  // localStorage 変更を購読: 同一タブ（CustomEvent）+ 別タブ（StorageEvent）
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleFlagChange = () => {
      setFlags(resolveFeatureFlags());
    };

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key?.startsWith('feature:')) {
        handleFlagChange();
      }
    };

    window.addEventListener(FEATURE_FLAGS_CHANGED_EVENT, handleFlagChange);
    window.addEventListener('storage', handleStorageEvent);
    return () => {
      window.removeEventListener(FEATURE_FLAGS_CHANGED_EVENT, handleFlagChange);
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  // 各フラグの変更を個別に検出してメモ化を最適化
  const memoized = useMemo(() => {
    currentSnapshot = flags;
    return flags;
  }, [
    flags.schedules,
    flags.complianceForm,
    flags.schedulesWeekV2,
    flags.icebergPdca,
    flags.staffAttendance,

    flags.todayOps,
    flags.todayLiteUi,
    flags.todayLiteNavV2,
  ]);

  return createElement(FeatureFlagsContext.Provider, { value: memoized }, children);
};

export const useFeatureFlags = (): FeatureFlagSnapshot => useContext(FeatureFlagsContext);

export const useFeatureFlag = (flag: keyof FeatureFlagSnapshot): boolean => {
  const flags = useFeatureFlags();
  return flags[flag] ?? false;
};

/**
 * localStorage にフラグを書き込み、同一タブの FeatureFlagsProvider に即時通知する。
 * 別タブへは native StorageEvent が自動的に通知する。
 *
 * @param key - フラグ名（'feature:' プレフィックスなし。例: 'todayLiteNavV2'）
 * @param flagValue - 設定する値
 */
export const setFeatureFlag = (key: string, flagValue: boolean): void => {
  try {
    window.localStorage.setItem(`feature:${key}`, flagValue ? 'true' : 'false');
  } catch {
    // ignore storage access errors (private mode, etc.)
  }
  window.dispatchEvent(new CustomEvent(FEATURE_FLAGS_CHANGED_EVENT));
};

/**
 * テスト用のリセット関数
 * currentSnapshot をデフォルト状態に戻し、テスト間の影響を排除
 */
export const __resetFeatureFlagsForTest = (): void => {
  currentSnapshot = initialSnapshot;
};
