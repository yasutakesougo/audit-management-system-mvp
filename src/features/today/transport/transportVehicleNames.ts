const TRANSPORT_VEHICLE_NAME_STORAGE_KEY = 'transport.vehicle-name-overrides.v1';

export const DEFAULT_TRANSPORT_VEHICLE_NAME_BY_ID: Readonly<Record<string, string>> = Object.freeze({
  車両1: 'ブルー',
  車両2: 'シルバー',
  車両3: 'ハイエース',
  車両4: 'スクラム',
});

export type TransportVehicleNameOverrides = Record<string, string>;

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOverrideRecord(value: unknown): TransportVehicleNameOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const next: TransportVehicleNameOverrides = {};
  for (const [rawKey, rawValue] of Object.entries(value)) {
    const key = normalizeText(rawKey);
    const name = normalizeText(rawValue);
    if (!key || !name) continue;
    next[key] = name;
  }
  return next;
}

export function getDefaultTransportVehicleName(vehicleId: string): string | null {
  return DEFAULT_TRANSPORT_VEHICLE_NAME_BY_ID[vehicleId] ?? null;
}

export function resolveTransportVehicleName(
  vehicleId: string,
  overrides: TransportVehicleNameOverrides = {},
): string {
  const normalizedVehicleId = normalizeText(vehicleId);
  if (!normalizedVehicleId) return '';

  const overrideName = normalizeText(overrides[normalizedVehicleId]);
  if (overrideName) return overrideName;

  return getDefaultTransportVehicleName(normalizedVehicleId) ?? normalizedVehicleId;
}

export function loadTransportVehicleNameOverrides(): TransportVehicleNameOverrides {
  if (typeof window === 'undefined' || !window.localStorage) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(TRANSPORT_VEHICLE_NAME_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return normalizeOverrideRecord(parsed);
  } catch {
    return {};
  }
}

export function saveTransportVehicleNameOverrides(overrides: TransportVehicleNameOverrides): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  try {
    const normalized = normalizeOverrideRecord(overrides);
    if (Object.keys(normalized).length === 0) {
      window.localStorage.removeItem(TRANSPORT_VEHICLE_NAME_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      TRANSPORT_VEHICLE_NAME_STORAGE_KEY,
      JSON.stringify(normalized),
    );
  } catch {
    // localStorage unavailable/full: ignore (UI fallback uses defaults)
  }
}

export function applyTransportVehicleNameOverride(
  overrides: TransportVehicleNameOverrides,
  vehicleId: string,
  inputName: string | null | undefined,
): TransportVehicleNameOverrides {
  const normalizedVehicleId = normalizeText(vehicleId);
  if (!normalizedVehicleId) return normalizeOverrideRecord(overrides);

  const normalizedName = normalizeText(inputName);
  const defaultName = getDefaultTransportVehicleName(normalizedVehicleId);
  const normalized = normalizeOverrideRecord(overrides);
  const next = { ...normalized };

  if (!normalizedName || normalizedName === defaultName) {
    delete next[normalizedVehicleId];
    return next;
  }

  next[normalizedVehicleId] = normalizedName;
  return next;
}

