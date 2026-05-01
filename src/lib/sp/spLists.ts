/**
 * SharePoint Client — List CRUD Operations (Façade)
 *
 * Thin orchestrator that wires the authenticated `spFetch` wrapper
 * into the extracted read / write / schema sub-modules and exposes
 * the same public API as before.
 *
 * Sub-modules:
 *   spListRead.ts   — getListItemsByTitle, listItems, getItemById, getItemByIdWithEtag
 *   spListWrite.ts  — addListItemByTitle, createItem, patchListItem, updateItemByTitle,
 *                      updateItem, deleteItemByTitle, deleteItem
 *   spListSchema.ts — tryGetListMetadata, fetchExistingFields, getListFieldInternalNames,
 *                      addFieldToList, ensureListExists
 */

import type { EnsureListOptions, JsonRecord, ListItemsOptions, SpFieldDef, SpRequestInit, SpRequestOptions } from './types';

// Sub-module imports
import {
    getItemById as _getItemById,
    getItemByIdWithEtag as _getItemByIdWithEtag,
    getListItemsByTitle as _getListItemsByTitle,
    listItems as _listItems,
} from './spListRead';
import {
    addFieldToList as _addFieldToList,
    updateField as _updateField,
    ensureListExists as _ensureListExists,
    fetchExistingFields as _fetchExistingFields,
    getListFieldInternalNames as _getListFieldInternalNames,
    tryGetListMetadata as _tryGetListMetadata,
    getExistingListTitlesAndIds as _getExistingListTitlesAndIds,
} from './spListSchema';
import {
    addListItemByTitle as _addListItemByTitle,
    createItem as _createItem,
    deleteItem as _deleteItem,
    deleteItemByTitle as _deleteItemByTitle,
    patchListItem as _patchListItem,
    updateItem as _updateItem,
    updateItemByTitle as _updateItemByTitle,
} from './spListWrite';

// ── Dependency interfaces ──────────────────────────────────────────────────
// These thin signatures decouple list operations from the full spClient.

/** Authenticated fetch wrapper returned by `createSpClient`. */
export type SpFetchFn = (path: string, init?: SpRequestInit) => Promise<Response>;

/** Path normalizer from spClient core. */
export type NormalizePathFn = (value: string) => string;

// ── Factory ────────────────────────────────────────────────────────────────

/**
 * Create list-level CRUD helpers bound to an authenticated `spFetch` wrapper.
 *
 * @example
 * ```ts
 * const lists = createListOperations(spFetch, normalizePath, baseUrl);
 * const items = await lists.listItems('MyList', { top: 50 });
 * ```
 */
export function createListOperations(
  spFetch: SpFetchFn,
  normalizePath: NormalizePathFn,
  baseUrl: string,
) {
  // ── Read ──────────────────────────────────────────────────────────────

  function getListItemsByTitle<T>(
    listTitle: string,
    select?: string[],
    filter?: string,
    orderby?: string,
    top: number = 500,
    signal?: AbortSignal,
    options: ListItemsOptions = {},
  ): Promise<T[]> {
    return _getListItemsByTitle<T>(spFetch, listTitle, select, filter, orderby, top, signal, options);
  }

  function listItems<TRow = JsonRecord>(
    listIdentifier: string,
    options: ListItemsOptions = {},
  ): Promise<TRow[]> {
    return _listItems<TRow>(spFetch, normalizePath, listIdentifier, options);
  }

  function getItemById<T>(
    listTitle: string,
    id: number,
    options: ListItemsOptions = {},
  ): Promise<T> {
    return _getItemById<T>(spFetch, listTitle, id, options);
  }

  function getItemByIdWithEtag<T>(
    listTitle: string,
    id: number,
    select: string[] = [],
    signal?: AbortSignal,
  ): Promise<{ item: T; etag: string | null }> {
    return _getItemByIdWithEtag<T>(spFetch, listTitle, id, select, signal);
  }

  // ── Create ────────────────────────────────────────────────────────────

  function addListItemByTitle<TBody extends object, TResult = unknown>(
    listTitle: string,
    body: TBody,
    options?: { signal?: AbortSignal },
  ): Promise<TResult> {
    return _addListItemByTitle<TBody, TResult>(spFetch, listTitle, body, options);
  }

  function createItem<TBody extends object, TResult = unknown>(
    listTitle: string,
    body: TBody,
    options?: { signal?: AbortSignal },
  ): Promise<TResult> {
    return _createItem<TBody, TResult>(spFetch, listTitle, body, options);
  }

  // ── Update ────────────────────────────────────────────────────────────

  function patchListItem<TBody extends object>(
    listIdentifier: string,
    id: number,
    body: TBody,
    ifMatch?: string,
  ): Promise<Response> {
    return _patchListItem<TBody>(spFetch, listIdentifier, id, body, ifMatch);
  }

  function updateItemByTitle<TBody extends object, TResult = unknown>(
    listTitle: string,
    id: number,
    body: TBody,
    options?: { ifMatch?: string; signal?: AbortSignal },
  ): Promise<TResult> {
    return _updateItemByTitle<TBody, TResult>(spFetch, listTitle, id, body, options);
  }

  function updateItem<TBody extends object, TResult = unknown>(
    listIdentifier: string,
    id: number,
    body: TBody,
    options?: { ifMatch?: string; signal?: AbortSignal },
  ): Promise<TResult> {
    return _updateItem<TBody, TResult>(spFetch, listIdentifier, id, body, options);
  }

  // ── Delete ────────────────────────────────────────────────────────────

  function deleteItemByTitle(
    listTitle: string, 
    id: number, 
    options?: { signal?: AbortSignal }
  ): Promise<void> {
    return _deleteItemByTitle(spFetch, listTitle, id, options);
  }

  function deleteItem(
    listIdentifier: string, 
    id: number, 
    options?: { signal?: AbortSignal }
  ): Promise<void> {
    return _deleteItem(spFetch, listIdentifier, id, options);
  }

  // ── List schema / metadata ────────────────────────────────────────────

  function tryGetListMetadata(listTitle: string, spOptions?: SpRequestOptions) {
    return _tryGetListMetadata(spFetch, listTitle, spOptions);
  }

  function getExistingListTitlesAndIds() {
    return _getExistingListTitlesAndIds(spFetch);
  }

  function fetchExistingFields(listTitle: string) {
    return _fetchExistingFields(spFetch, listTitle);
  }

  function getListFieldInternalNames(listTitle: string) {
    return _getListFieldInternalNames(spFetch, baseUrl, listTitle);
  }

  function addFieldToList(listTitle: string, field: SpFieldDef) {
    return _addFieldToList(spFetch, listTitle, field);
  }

  function updateField(listTitle: string, internalName: string, updates: { Indexed?: boolean }) {
    return _updateField(spFetch, listTitle, internalName, updates);
  }

  function ensureListExists(
    listTitle: string,
    fields: SpFieldDef[],
    options: EnsureListOptions = {},
  ) {
    return _ensureListExists(spFetch, listTitle, fields, options);
  }

  // ── Public API ────────────────────────────────────────────────────────

  return {
    // Read
    getListItemsByTitle,
    listItems,
    getItemById,
    getItemByIdWithEtag,
    // Create
    addListItemByTitle,
    /** @deprecated Use `addListItemByTitle`. Kept for backward compatibility. */
    addItemByTitle: addListItemByTitle,
    createItem,
    // Update
    patchListItem,
    updateItemByTitle,
    updateItem,
    // Delete
    deleteItemByTitle,
    deleteItem,
    // List schema / metadata
    tryGetListMetadata,
    getExistingListTitlesAndIds,
    fetchExistingFields,
    getListFieldInternalNames,
    addFieldToList,
    updateField,
    ensureListExists,
  };
}

// ── Re-export factory return type for external typing ──────────────────────

export type SpListOperations = ReturnType<typeof createListOperations>;
