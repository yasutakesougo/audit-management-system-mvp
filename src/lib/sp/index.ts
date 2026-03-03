/**
 * SharePoint Client — Public barrel export
 * Re-exports extracted modules for cleaner imports.
 */

// Types (Single Source of Truth: ./types.ts)
export type {
    E2eDebugWindow, EnsureListOptions, EnsureListResult, ExistingFieldShape,
    FieldsCacheEntry, JsonRecord, ListItemsOptions, RetryReason,
    SharePointBatchOperation, SharePointBatchResult, SharePointListMetadata,
    SharePointRetryMeta, SpClientOptions, SpFieldDef, SpFieldType,
    SpListItems, StaffIdentifier
} from './types';

// Response parsing (from types.ts)
export { parseSpListResponse } from './types';

// Schema (XML builder, escapeXml, GUID helpers)
export { buildFieldSchema, escapeXml, trimGuidBraces, withGuidBraces } from './spSchema';

// Batch
export { buildBatchPayload, parseBatchResponse } from './spBatch';

// Helpers (Single Source of Truth: ./helpers.ts)
export {
    DEFAULT_LIST_TEMPLATE, DEFAULT_STAFF_LIST_TITLE, DEFAULT_USERS_LIST_TITLE,
    FIELDS_CACHE_TTL_MS, STAFF_BASE_FIELDS, STAFF_OPTIONAL_FIELDS,
    USERS_BASE_FIELDS, USERS_OPTIONAL_FIELDS,
    buildItemPath, buildListItemsPath, buildSelectFields, clampTop,
    classifyRetry, extractMissingField, getMissingSet, makeFieldsCacheKey,
    markOptionalMissing, normalizeGuidCandidate, nowMs, raiseHttpError,
    readErrorPayload, resetMissingOptionalFieldsCache, resolveListPath,
    resolveStaffListIdentifier, safeJsonParse, safeJsonStringify,
    sanitizeEnvValue
} from './helpers';

// List CRUD operations (factory)
export { createListOperations } from './spLists';
export type { NormalizePathFn, SpFetchFn, SpListOperations } from './spLists';
