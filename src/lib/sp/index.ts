/**
 * SharePoint Client — Public barrel export
 * Re-exports extracted modules for cleaner imports.
 */

// Types
export type {
    E2eDebugWindow, EnsureListOptions, EnsureListResult, ExistingFieldShape, FieldsCacheEntry, JsonRecord, ListItemsOptions, RetryReason, SharePointBatchOperation,
    SharePointBatchResult, SharePointListMetadata, SharePointRetryMeta,
    SpClientOptions, SpFieldDef, SpFieldType, StaffIdentifier
} from './spTypes';

// Schema
export { buildFieldSchema, escapeXml, trimGuidBraces, withGuidBraces } from './spSchema';

// Batch
export { buildBatchPayload, parseBatchResponse } from './spBatch';

// Helpers
export {
    DEFAULT_LIST_TEMPLATE, DEFAULT_STAFF_LIST_TITLE, DEFAULT_USERS_LIST_TITLE, FIELDS_CACHE_TTL_MS, STAFF_BASE_FIELDS,
    STAFF_OPTIONAL_FIELDS, USERS_BASE_FIELDS,
    USERS_OPTIONAL_FIELDS, buildItemPath,
    buildListItemsPath, buildSelectFields, clampTop, classifyRetry, extractMissingField, getMissingSet, makeFieldsCacheKey, markOptionalMissing, normalizeGuidCandidate, nowMs, readErrorPayload,
    resetMissingOptionalFieldsCache, resolveListPath, resolveStaffListIdentifier, safeJsonParse,
    safeJsonStringify, sanitizeEnvValue
} from './spHelpers';
