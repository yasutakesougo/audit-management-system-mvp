/**
 * SharePoint Master Data Fetchers
 *
 * Extracted from spClient.ts for single-responsibility.
 * getUsersMaster / getStaffMaster / fetchListItemsWithFallback.
 */

import { readEnv } from '@/lib/env';
import {
    buildListItemsPath,
    buildSelectFields,
    clampTop,
    DEFAULT_STAFF_LIST_TITLE,
    DEFAULT_USERS_LIST_TITLE,
    extractMissingField,
    getMissingSet,
    markOptionalMissing,
    resolveStaffListIdentifier,
    sanitizeEnvValue,
    STAFF_BASE_FIELDS,
    STAFF_OPTIONAL_FIELDS,
    USERS_BASE_FIELDS,
    USERS_OPTIONAL_FIELDS,
} from './helpers';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ListClient = Pick<{ spFetch: (path: string, init?: RequestInit) => Promise<Response> }, 'spFetch'>;

// ─── fetchListItemsWithFallback ─────────────────────────────────────────────

export async function fetchListItemsWithFallback<TRow>(
  client: ListClient,
  listTitle: string,
  baseFields: readonly string[],
  optionalFields: readonly string[],
  top: number
): Promise<TRow[]> {
  const missing = getMissingSet(listTitle);
  let select = buildSelectFields(baseFields, optionalFields, missing);
  const maxAttempts = optionalFields.length + 2;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const path = buildListItemsPath(listTitle, select, top);
      const res = await client.spFetch(path);
      const json = (!res || typeof (res as Response | { json?: unknown }).json !== 'function')
        ? ({ value: [] } as { value?: TRow[] })
        : await (res as Response).json().catch(() => ({ value: [] })) as { value?: TRow[] };
      return (json.value ?? []) as TRow[];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const missingField = extractMissingField(message);
      if (missingField) {
        markOptionalMissing(listTitle, missingField);
      } else {
        const remaining = optionalFields.filter((field) => !getMissingSet(listTitle).has(field));
        const fallbackField = remaining.pop();
        if (!fallbackField) {
          throw error;
        }
        markOptionalMissing(listTitle, fallbackField);
      }
      select = buildSelectFields(baseFields, optionalFields, getMissingSet(listTitle));
    }
  }
  const finalPath = buildListItemsPath(listTitle, select, top);
  throw new Error(`Failed to fetch list "${listTitle}" after optional field retries. Last query: ${finalPath}`);
}

// ─── getUsersMaster ─────────────────────────────────────────────────────────

export async function getUsersMaster<TRow = Record<string, unknown>>(
  client: ListClient,
  top?: number
): Promise<TRow[]> {
  const listTitle = sanitizeEnvValue(readEnv('VITE_SP_LIST_USERS', '')) || DEFAULT_USERS_LIST_TITLE;
  return fetchListItemsWithFallback<TRow>(
    client, listTitle, USERS_BASE_FIELDS, USERS_OPTIONAL_FIELDS, clampTop(top)
  );
}

// ─── getStaffMaster ─────────────────────────────────────────────────────────

export async function getStaffMaster<TRow = Record<string, unknown>>(
  client: ListClient,
  top?: number
): Promise<TRow[]> {
  const listTitleCandidate = sanitizeEnvValue(readEnv('VITE_SP_LIST_STAFF', '')) || DEFAULT_STAFF_LIST_TITLE;
  const listGuidCandidate = sanitizeEnvValue(readEnv('VITE_SP_LIST_STAFF_GUID', ''));
  const identifier = resolveStaffListIdentifier(listTitleCandidate, listGuidCandidate);
  const listKey = identifier.value;
  return fetchListItemsWithFallback<TRow>(
    client, listKey, STAFF_BASE_FIELDS, STAFF_OPTIONAL_FIELDS, clampTop(top)
  );
}
