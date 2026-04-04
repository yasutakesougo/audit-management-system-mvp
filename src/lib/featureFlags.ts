/**
 * Feature Flags — Dedicated module for runtime feature flag queries.
 *
 * Re-exports feature flag functions from env.ts for cleaner, semantically
 * meaningful imports. Consumer code can import from '@/lib/featureFlags'
 * instead of '@/lib/env' to make intent clear.
 *
 * Extracted from env.ts to reduce its 646-line scope.
 */

// eslint-disable-next-line no-restricted-imports -- deliberate re-export facade
export {
    allowWriteFallback,
    // Generic flag reader
    getFlag, getScheduleSaveMode, isAuditDebugEnabled, isComplianceFormEnabled, isDemo, isDemoModeEnabled,
    // Mode detection
    isDevMode, isE2E, isE2eMsalMockEnabled, isForceDemoEnabled, isIcebergPdcaEnabled,
    // Schedule save
    isScheduleSaveMocked,
    // Feature toggles
    isSchedulesFeatureEnabled,
    isSchedulesSpEnabled,
    isSchedulesWeekV2Enabled, isStaffAttendanceEnabled, isTestMode, isTodayLiteUiFeatureEnabled, isTodayOpsFeatureEnabled,
    isUsersCrudEnabled, isWriteEnabled, shouldSkipLogin, shouldSkipSharePoint,
    // SharePoint flags
    skipSharePoint, type ScheduleSaveMode
} from './env';
