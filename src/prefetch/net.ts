import type { PrefetchSource } from './tracker';

type NetworkSnapshot = {
  downlink?: number;
  effectiveType?: string;
  rtt?: number;
  saveData?: boolean;
  online?: boolean;
};

type GuardOverrides = {
  disable: boolean | null;
  network: NetworkSnapshot | null;
  saveData: boolean | null;
  online: boolean | null;
};

const LOW_BANDWIDTH_DOWNLINK = 1.5;
const HIGH_RTT = 400;

const overrides: GuardOverrides = {
  disable: null,
  network: null,
  saveData: null,
  online: null,
};

const readEnvDisable = (): boolean => {
  const inline = (import.meta as ImportMeta).env ?? {};
  const candidate = (inline as Record<string, string | undefined>).VITE_PREFETCH_DISABLE;
  if (candidate) {
    const normalized = candidate.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes';
  }
  if (typeof process !== 'undefined' && process.env?.VITE_PREFETCH_DISABLE) {
    const normalized = process.env.VITE_PREFETCH_DISABLE.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes';
  }
  return false;
};

const pickConnection = (): NetworkSnapshot => {
  if (overrides.network) {
    return overrides.network;
  }
  if (typeof navigator !== 'undefined') {
    const anyNavigator = navigator as Navigator & {
      connection?: Partial<NetworkSnapshot> & { effectiveType?: string; downlink?: number; rtt?: number; saveData?: boolean };
    };
    const connection = anyNavigator.connection;
    return {
      downlink: connection?.downlink,
      effectiveType: connection?.effectiveType,
      rtt: connection?.rtt,
      saveData: connection?.saveData,
      online: typeof navigator.onLine === 'boolean' ? navigator.onLine : undefined,
    };
  }
  return {};
};

const isSaveDataEnabled = (snapshot: NetworkSnapshot): boolean => {
  if (overrides.saveData != null) {
    return overrides.saveData;
  }
  return snapshot.saveData === true;
};

export const setPrefetchDisableOverride = (value: boolean | null): void => {
  overrides.disable = value;
};

export const setNetworkSnapshotOverride = (snapshot: NetworkSnapshot | null): void => {
  overrides.network = snapshot;
};

export const setSaveDataOverride = (value: boolean | null): void => {
  overrides.saveData = value;
};

export const setOnlineOverride = (value: boolean | null): void => {
  overrides.online = value;
};

const isOnline = (snapshot: NetworkSnapshot): boolean => {
  if (overrides.online != null) {
    return overrides.online;
  }
  if (typeof snapshot.online === 'boolean') {
    return snapshot.online;
  }
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
};

export const canPrefetch = (source: PrefetchSource): boolean => {
  const disabled = overrides.disable === true || (overrides.disable === null && readEnvDisable());
  if (disabled) {
    return false;
  }
  const snapshot = pickConnection();
  if (!isOnline(snapshot)) {
    return false;
  }
  if (isSaveDataEnabled(snapshot)) {
    return false;
  }
  const downlink = typeof snapshot.downlink === 'number' ? snapshot.downlink : undefined;
  const rtt = typeof snapshot.rtt === 'number' ? snapshot.rtt : undefined;
  if (downlink !== undefined && downlink < LOW_BANDWIDTH_DOWNLINK) {
    return source === 'hover' || source === 'kbd';
  }
  if (rtt !== undefined && rtt > HIGH_RTT && (source === 'viewport' || source === 'idle')) {
    return false;
  }
  return true;
};

export const getNetworkSnapshot = (): NetworkSnapshot => pickConnection();
