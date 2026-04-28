/**
 * SharePoint Client — Orchestrator
 *
 * Thin factory that assembles spFetch, postBatch, listOps, and batch
 * from extracted sub-modules. All heavy logic lives in:
 *   - sp/spFetch.ts      (HTTP fetch + retry + mock)
 *   - sp/spPostBatch.ts  (batch POST + retry)
 *   - sp/spBatch.ts      (batch payload builder / parser)
 *   - sp/spLists.ts      (CRUD operations)
 *   - sp/spMasters.ts    (getUsersMaster, getStaffMaster)
 */

import { useAuth } from '@/auth/useAuth';
import type { UnifiedResourceEvent } from '@/features/resources/types';
import { isDebugFlag } from '@/lib/debugFlag';
import { getAppConfig, readEnv, type EnvRecord } from '@/lib/env';
import { useMemo } from 'react';

// ─── Extracted sub-modules ──────────────────────────────────────────────────

import { ensureConfig } from '@/lib/sp/config';
import { buildBatchPayload, parseBatchResponse } from '@/lib/sp/spBatch';
import { createNormalizePath, createSpFetch } from '@/lib/sp/spFetch';
import { createListOperations } from '@/lib/sp/spLists';
import { createPostBatch } from '@/lib/sp/spPostBatch';

// ─── Re-exports for backward compatibility ──────────────────────────────────

export { ensureConfig } from '@/lib/sp/config';
export { clearAllFieldsCache, clearFieldsCacheFor } from '@/lib/sp/helpers';
export { getStaffMaster, getUsersMaster } from '@/lib/sp/spMasters';
export { parseSpListResponse, type JsonRecord } from '@/lib/sp/types';
export type {
    EnsureListResult, SharePointBatchOperation,
    SharePointBatchResult, SharePointRetryMeta,
    SpClientOptions, SpFieldDef
} from '@/lib/sp/types';

// ─── Internal imports ───────────────────────────────────────────────────────

import { buildItemPath, resetMissingOptionalFieldsCache, resolveStaffListIdentifier } from '@/lib/sp/helpers';
import { buildFieldSchema } from '@/lib/sp/spSchema';
import type {
    SharePointBatchOperation,
    SharePointBatchResult,
    SpClientOptions,
} from '@/lib/sp/types';

// ─── createSpClient ─────────────────────────────────────────────────────────

/**
 * テスト可能なクライアントファクトリ（React Hook に依存しない）
 * - acquireToken: トークン取得関数（MSAL由来を想定）
 * - baseUrl: 例) https://contoso.sharepoint.com/sites/Audit/_api/web
 */
export function createSpClient(
  acquireToken: () => Promise<string | null>,
  baseUrl: string,
  options: SpClientOptions = {}
) {
  const config = getAppConfig();
  // Derive a typed EnvRecord from AppConfig without unsafe double-cast.
  // AppConfig values are all Primitive (string | number | boolean | null | undefined),
  // so spreading them satisfies the EnvRecord constraint.
  const envRecord: EnvRecord = { ...config } as EnvRecord;
  const spSiteLegacy = readEnv('VITE_SP_SITE', '', envRecord);
  const retrySettings = {
    maxAttempts: Number(config.VITE_SP_RETRY_MAX) || 4,
    baseDelay: Number(config.VITE_SP_RETRY_BASE_MS) || 400,
    capDelay: Number(config.VITE_SP_RETRY_MAX_DELAY_MS) || 5000,
  } as const;
  const debugEnabled = isDebugFlag(config.VITE_AUDIT_DEBUG);

  // ── Path normalizer ──
  const normalizePath = createNormalizePath(envRecord, spSiteLegacy, baseUrl);

  // ── Core fetch (with retry + mock + auth) ──
  const rawSpFetch = createSpFetch({
    acquireToken, baseUrl,
    config: envRecord,
    retrySettings, debugEnabled, spSiteLegacy,
    onRetry: options.onRetry,
  });

  // Wrap with normalizePath so callers pass raw paths
  const spFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
    return rawSpFetch(normalizePath(path), init);
  };

  // ── List CRUD (delegated to spLists.ts) ──
  const listOps = createListOperations(spFetch, normalizePath, baseUrl);
  const {
    getListItemsByTitle, listItems,
    addListItemByTitle, getItemById, getItemByIdWithEtag,
    createItem, updateItemByTitle, updateItem,
    patchListItem,
    deleteItemByTitle, deleteItem,
    tryGetListMetadata, getListFieldInternalNames, ensureListExists,
    fetchExistingFields, addFieldToList, updateField,
    getExistingListTitlesAndIds,
  } = listOps;

  /** @deprecated Use `addListItemByTitle`. Kept for backward compatibility. */
  const addItemByTitle = addListItemByTitle;

  // ── Batch ($batch POST + payload assemble) ──
  const postBatch = createPostBatch({
    spFetch, baseUrl,
    config: envRecord,
  });

  const batch = async (operations: SharePointBatchOperation[]): Promise<SharePointBatchResult[]> => {
    if (!operations.length) return [];
    const boundary = `batch_${Math.random().toString(36).slice(2)}`;
    const requestBody = buildBatchPayload(operations, boundary, normalizePath, buildItemPath);
    const res = await postBatch(requestBody, boundary);
    const contentType = res.headers.get('Content-Type') ?? '';
    const match = /boundary=([^;]+)/i.exec(contentType);
    const responseBoundary = match ? match[1].trim() : boundary;
    const text = await res.text();
    return parseBatchResponse(text, responseBoundary);
  };

  return {
    spFetch,
    getListItemsByTitle, listItems,
    addListItemByTitle, addItemByTitle,
    updateItemByTitle, deleteItemByTitle,
    getItemById, getItemByIdWithEtag,
    createItem, updateItem, deleteItem,
    patchListItem,
    batch, postBatch,
    ensureListExists, tryGetListMetadata, getListFieldInternalNames,
    fetchExistingFields, addFieldToList, updateField,
    getExistingListTitlesAndIds,
  };
}

// ─── useSP Hook ─────────────────────────────────────────────────────────────

export const useSP = () => {
  const { acquireToken } = useAuth();
  const cfg = useMemo(() => ensureConfig(), []);
  const client = useMemo(() => createSpClient(acquireToken, cfg.baseUrl), [acquireToken, cfg.baseUrl]);
  return client;
};

// ─── Placeholder clients ────────────────────────────────────────────────────

export type IntegratedResourceCalendarClient = {
  getUnifiedEvents: () => Promise<UnifiedResourceEvent[]>;
};

export const createIrcSpClient = (): IntegratedResourceCalendarClient => ({
  async getUnifiedEvents() { return []; },
});

export async function createSchedule<T extends Record<string, unknown>>(_sp: UseSP, payload: T): Promise<T> {
  return payload;
}

// ─── Test / internal exports ────────────────────────────────────────────────

export const __ensureListInternals = { buildFieldSchema };
export const __test__ = {
  ensureConfig,
  resetMissingOptionalFieldsCache,
  resolveStaffListIdentifier,
};

export type UseSP = ReturnType<typeof useSP>;
