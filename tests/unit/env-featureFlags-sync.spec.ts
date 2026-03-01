/**
 * env-featureFlags sync test
 *
 * Ensures that:
 * 1. Every feature flag in FeatureFlagSnapshot has a corresponding is*Enabled function in env.ts
 * 2. Every is*Enabled/is*FeatureEnabled function imported by featureFlags.ts actually exists in env.ts
 * 3. No accidental runtime crashes from missing exports
 */
import { resolveFeatureFlags, type FeatureFlagSnapshot } from '@/config/featureFlags';
import {
    isComplianceFormEnabled,
    isIcebergPdcaEnabled,
    isSchedulesFeatureEnabled,
    isSchedulesWeekV2Enabled,
    isStaffAttendanceEnabled,
    isTestMode,
    isTodayOpsFeatureEnabled,
    readBool,
    readOptionalEnv,
    type EnvRecord,
} from '@/lib/env';
import { describe, expect, it } from 'vitest';

// Map: snapshot key → env.ts resolver function
// This mapping is the authoritative source-of-truth for the sync contract.
// If a new flag is added to FeatureFlagSnapshot, a corresponding entry MUST be added here.
const FLAG_RESOLVER_MAP: Record<keyof FeatureFlagSnapshot, (envOverride?: EnvRecord) => boolean> = {
  schedules: isSchedulesFeatureEnabled,
  complianceForm: isComplianceFormEnabled,
  schedulesWeekV2: isSchedulesWeekV2Enabled,
  icebergPdca: isIcebergPdcaEnabled,
  staffAttendance: isStaffAttendanceEnabled,

  todayOps: isTodayOpsFeatureEnabled,
};

describe('env ↔ featureFlags export sync', () => {
  it('every FeatureFlagSnapshot key has a callable resolver from env.ts', () => {
    const snapshotKeys = Object.keys(FLAG_RESOLVER_MAP) as (keyof FeatureFlagSnapshot)[];

    for (const key of snapshotKeys) {
      const resolver = FLAG_RESOLVER_MAP[key];
      expect(typeof resolver, `resolver for "${key}" must be a function`).toBe('function');
      // Call it to ensure it doesn't throw (detects missing exports at runtime)
      expect(() => resolver()).not.toThrow();
    }
  });

  it('FLAG_RESOLVER_MAP covers every key in FeatureFlagSnapshot', () => {
    const snapshot = resolveFeatureFlags();
    const snapshotKeys = Object.keys(snapshot).sort();
    const mapKeys = Object.keys(FLAG_RESOLVER_MAP).sort();

    expect(mapKeys).toEqual(snapshotKeys);
  });

  it('resolveFeatureFlags() returns only boolean values', () => {
    const snapshot = resolveFeatureFlags();

    for (const [key, value] of Object.entries(snapshot)) {
      expect(typeof value, `snapshot.${key} must be boolean`).toBe('boolean');
    }
  });

  it('env.ts utility exports used by featureFlags are callable', () => {
    // These are supporting exports that featureFlags.ts depends on.
    // If any of these disappear, featureFlags.ts will crash.
    expect(typeof readBool).toBe('function');
    expect(typeof readOptionalEnv).toBe('function');
    expect(typeof isTestMode).toBe('function');
  });

  it('every flag consumed by CreateNavItemsConfig has a matching FeatureFlagSnapshot key', () => {
    // Map: CreateNavItemsConfig field → FeatureFlagSnapshot key
    // When adding a new *Enabled field to CreateNavItemsConfig, add a mapping here.
    // If the snapshot key is missing, this test fails — catching the "nav uses a flag
    // that FeatureFlagSnapshot forgot to include" bug.
    const NAV_CONFIG_TO_SNAPSHOT: Record<string, keyof FeatureFlagSnapshot> = {
      schedulesEnabled: 'schedules',
      complianceFormEnabled: 'complianceForm',
      icebergPdcaEnabled: 'icebergPdca',
      staffAttendanceEnabled: 'staffAttendance',
      todayOpsEnabled: 'todayOps',
    };

    const snapshot = resolveFeatureFlags();
    const snapshotKeys = new Set(Object.keys(snapshot));

    for (const [configField, snapshotKey] of Object.entries(NAV_CONFIG_TO_SNAPSHOT)) {
      expect(
        snapshotKeys.has(snapshotKey),
        `CreateNavItemsConfig.${configField} maps to FeatureFlagSnapshot.${snapshotKey}, but that key does not exist in the snapshot`,
      ).toBe(true);
    }
  });
});
