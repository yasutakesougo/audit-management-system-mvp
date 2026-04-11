/**
 * SharePoint Client — Type Definitions (Single Source of Truth)
 *
 * Consolidated from former types.ts + spTypes.ts.
 * Every SP module imports types from this file only.
 */
import { auditLog } from '@/lib/debugLogger';
import { z } from 'zod';

// ─── Basic types ─────────────────────────────────────────────────

export type JsonRecord = Record<string, unknown>;

// ─── Retry types ─────────────────────────────────────────────────

export type RetryReason = 'throttle' | 'timeout' | 'server';

export type SharePointRetryMeta = {
  attempt: number;
  status?: number;
  reason: RetryReason;
  delayMs: number;
};

export interface SpClientOptions {
  onRetry?: (response: Response, meta: SharePointRetryMeta) => void;
}

// ─── Batch types ─────────────────────────────────────────────────

export type SharePointBatchOperation =
  | {
      kind: 'create';
      list: string;
      body: JsonRecord;
      headers?: Record<string, string>;
    }
  | {
      kind: 'update';
      list: string;
      id: number;
      body: JsonRecord;
      etag?: string;
      method?: 'PATCH' | 'MERGE';
      headers?: Record<string, string>;
    }
  | {
      kind: 'delete';
      list: string;
      id: number;
      etag?: string;
      headers?: Record<string, string>;
    };

export type SharePointBatchResult<T = unknown> = {
  ok: boolean;
  status: number;
  data?: T | string;
};

// ─── Field / List types ──────────────────────────────────────────

export type SpFieldType =
  | 'Text'
  | 'Note'
  | 'Choice'
  | 'MultiChoice'
  | 'Number'
  | 'Boolean'
  | 'Lookup'
  | 'DateTime'
  | 'Currency';

export interface SpFieldDef {
  internalName: string;
  type: SpFieldType;
  displayName?: string;
  description?: string;
  required?: boolean;
  /** SharePoint restrictions bypass: True ensures column is always created even if not marked required */
  forceCreate?: boolean;
  choices?: readonly string[];
  default?: string | number | boolean;
  lookupListId?: string;
  lookupFieldName?: string;
  allowMultiple?: boolean;
  dateTimeFormat?: 'DateOnly' | 'DateTime';
  richText?: boolean;
  addToDefaultView?: boolean;
  /** インデックスを付与する（5000件制限回避のため、フィルター対象フィールドに必須） */
  indexed?: boolean;
  /**
   * フィールド解決の候補名リスト。
   * 指定されている場合、既存フィールドのチェック時にこれらも含めて検索し、二重作成を防止する。
   */
  candidates?: readonly string[];
}

export interface EnsureListOptions {
  baseTemplate?: number;
  /**
   * If true, prevents addFieldToList from being called for any field.
   * Useful for split architecture or when reaching SharePoint row limits.
   */
  preventPhysicalCreation?: boolean;
}

export interface ExistingFieldShape {
  InternalName: string;
  TypeAsString?: string;
  Required?: boolean;
  Indexed?: boolean;
}

export type FailedFieldReason =
  | 'row_size_limit'
  | 'indexed_column_limit'
  | 'http_error'
  | 'unknown';

export interface FailedFieldInfo {
  internalName: string;
  required: boolean;
  reason: FailedFieldReason;
  status?: number;
  detail?: string;
}

export interface EnsureListResult {
  listId: string;
  title: string;
  /** Fields that were attempted but not physically created. Present only when at least one attempt failed. */
  failedFields?: FailedFieldInfo[];
}

export interface SharePointListMetadata {
  Id?: string;
  Title?: string;
  d?: {
    Id?: string;
    Title?: string;
  };
}

// ─── Fields Cache types ──────────────────────────────────────────

export type FieldsCacheEntry = {
  v: 1;
  savedAt: number;
  listTitle: string;
  siteUrl: string;
  internalNames: string[];
};

// ─── E2E Debug ───────────────────────────────────────────────────

export type E2eDebugWindow = Window & {
  __E2E_BATCH_URL__?: string;
  __E2E_BATCH_ATTEMPTS__?: number;
};

// ─── Zod helper ──────────────────────────────────────────────────

export type SpListItems<T extends z.ZodTypeAny> = z.infer<T>[];

// ─── List items query ────────────────────────────────────────────

export type ListItemsOptions = {
  select?: string[];
  filter?: string;
  orderby?: string;
  expand?: string;
  top?: number;
  pageCap?: number;
  signal?: AbortSignal;
};

// ─── Staff identifier ────────────────────────────────────────────

export type StaffIdentifier = { type: 'guid' | 'title'; value: string };

// ─── Response parsing ────────────────────────────────────────────

/**
 * Parse a SharePoint REST API list response with per-item Zod validation.
 * Invalid items are logged but not included in the result (Partial Failure pattern).
 */
export function parseSpListResponse<T extends z.ZodTypeAny>(
  json: unknown,
  itemSchema: T,
): z.infer<T>[] {
  // 1. Validate the outer OData envelope shape first
  const envelopeSchema = z.object({ value: z.array(z.unknown()).default([]) });
  const envelopeParsed = envelopeSchema.safeParse(json);

  if (!envelopeParsed.success) {
    auditLog.error('sp', 'envelope_mismatch', { error: envelopeParsed.error.format() });
    throw new Error('SharePoint response envelope validation failed. Expected { value: [...] }');
  }

  const rawItems = envelopeParsed.data.value;
  const validItems: z.infer<T>[] = [];
  const errors: { index: number; id?: unknown; issues: z.ZodFormattedError<unknown> }[] = [];

  // 2. Safely parse each item individually to support Partial Failures
  rawItems.forEach((rawItem, index) => {
    const itemParsed = itemSchema.safeParse(rawItem);
    if (itemParsed.success) {
      validItems.push(itemParsed.data);
    } else {
      // Capture identifier if available to help with tracing
      const id =
        (rawItem as Record<string, unknown>)?.Id ?? (rawItem as Record<string, unknown>)?.ID;
      errors.push({
        index,
        id,
        issues: itemParsed.error.format(),
      });
    }
  });

  // 3. Telemetry hook: Log specific item failures without crashing the whole list
  if (errors.length > 0) {
    auditLog.error(
      'sp',
      'partial_validation_failure',
      {
        failedCount: errors.length,
        totalCount: rawItems.length,
        errors,
      },
    );
  }

  return validItems;
}

// ─── Request types ───────────────────────────────────────────────

export interface SpRequestOptions {
  /** Suppress error logging for these status codes. Error will still be thrown if throwOnError is true. */
  quietStatuses?: number[];
  /** If true, do not log any errors to auditLog. */
  silent?: boolean;
  /** Disable automatic retry for this specific request. */
  skipRetry?: boolean;
  /** Custom timeout in ms to replace the default 30s timeout. */
  timeoutMs?: number;
  /** Explicitly set the number of retries for this request */
  retries?: number;
}

/** Extended RequestInit with SharePoint-specific steering options */
export type SpRequestInit = RequestInit & {
  spOptions?: SpRequestOptions;
};

// ─── XML / GUID helpers (re-exported from spSchema for backward compat) ──

export { escapeXml, trimGuidBraces, withGuidBraces } from './spSchema';
