/**
 * SharePoint Client — Type Definitions
 * Extracted from spClient.ts for single-responsibility.
 */

import type { z } from 'zod';

// ── Primitive aliases ──
export type JsonRecord = Record<string, unknown>;

// ── Batch ──
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

// ── Retry ──
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

// ── Field Schema ──
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
  choices?: readonly string[];
  default?: string | number | boolean;
  lookupListId?: string;
  lookupFieldName?: string;
  allowMultiple?: boolean;
  dateTimeFormat?: 'DateOnly' | 'DateTime';
  richText?: boolean;
  addToDefaultView?: boolean;
}

export interface EnsureListOptions {
  baseTemplate?: number;
}

export interface ExistingFieldShape {
  InternalName: string;
  TypeAsString?: string;
  Required?: boolean;
}

export interface EnsureListResult {
  listId: string;
  title: string;
}

export interface SharePointListMetadata {
  Id?: string;
  Title?: string;
  d?: {
    Id?: string;
    Title?: string;
  };
}

// ── Fields Cache ──
export type FieldsCacheEntry = {
  v: 1;
  savedAt: number;
  listTitle: string;
  siteUrl: string;
  internalNames: string[];
};

// ── E2E Debug ──
export type E2eDebugWindow = Window & {
  __E2E_BATCH_URL__?: string;
  __E2E_BATCH_ATTEMPTS__?: number;
};

// ── Zod helper ──
export type SpListItems<T extends z.ZodTypeAny> = z.infer<T>[];

// ── List items query ──
export type ListItemsOptions = {
  select?: string[];
  filter?: string;
  orderby?: string;
  expand?: string;
  top?: number;
  pageCap?: number;
  signal?: AbortSignal;
};

// ── Staff identifier ──
export type StaffIdentifier = { type: 'guid' | 'title'; value: string };
