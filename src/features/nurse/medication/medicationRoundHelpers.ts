/**
 * medicationRoundHelpers.ts — Pure helper functions for MedicationRound.
 *
 * All functions are side-effect-free and independently testable.
 * Extracted from MedicationRound.tsx.
 */
import type { NurseUser } from '@/features/nurse/users';
import type { MedicationInventoryEntry } from './medicationRoundTypes';
import { DEFAULT_INVENTORY_SEED } from './medicationRoundTypes';

// ---------------------------------------------------------------------------
// Status classification
// ---------------------------------------------------------------------------

export type StatusFilter = 'all' | 'ok' | 'expiring' | 'expired';

export const statusColorMap: Record<StatusFilter, 'default' | 'warning' | 'error' | 'success'> = {
  all: 'default',
  ok: 'success',
  expiring: 'warning',
  expired: 'error',
};

/** Classify an inventory entry by its expiration date relative to today. */
export const categorizeStatus = (entry: MedicationInventoryEntry): StatusFilter => {
  const today = new Date();
  const exp = new Date(entry.expirationDate);
  const diffMs = exp.getTime() - today.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'expired';
  if (diffDays <= 30) return 'expiring';
  return 'ok';
};

/** Human-readable label for a StatusFilter value. */
export const statusLabel = (status: StatusFilter): string => {
  if (status === 'ok') return '良好';
  if (status === 'expiring') return '30日以内';
  if (status === 'expired') return '期限切れ';
  return 'すべて';
};

// ---------------------------------------------------------------------------
// Inventory helpers
// ---------------------------------------------------------------------------

/**
 * Build the default per-user inventory map from seed data.
 * Entries are cloned to prevent accidental mutation of the frozen seed.
 */
export const createDefaultInventoryByUser = (
  users: NurseUser[],
): Record<string, MedicationInventoryEntry[]> => {
  const result: Record<string, MedicationInventoryEntry[]> = {};
  for (const user of users) {
    const template = DEFAULT_INVENTORY_SEED[user.id];
    result[user.id] = template ? template.map((entry) => ({ ...entry })) : [];
  }
  return result;
};

/**
 * Merge inventory override on top of a base map.
 * Override entries take priority per user; base entries are used as fallback.
 */
export const mergeInventory = (
  base: Record<string, MedicationInventoryEntry[]>,
  overrides?: Record<string, MedicationInventoryEntry[]>,
): Record<string, MedicationInventoryEntry[]> => {
  const merged: Record<string, MedicationInventoryEntry[]> = {};
  const ids = new Set([...Object.keys(base), ...(overrides ? Object.keys(overrides) : [])]);
  ids.forEach((id) => {
    const overrideEntries = overrides?.[id];
    if (overrideEntries?.length) {
      merged[id] = overrideEntries.map((entry, index) => ({
        ...entry,
        id: entry.id ?? index + 1,
      }));
    } else {
      merged[id] = base[id] ? base[id].map((entry) => ({ ...entry })) : [];
    }
  });
  return merged;
};

// ---------------------------------------------------------------------------
// Filter helper
// ---------------------------------------------------------------------------

/** Filter inventory entries by status and free-text search. */
export const filterInventory = (
  inventory: MedicationInventoryEntry[],
  statusFilter: StatusFilter,
  search: string,
): MedicationInventoryEntry[] => {
  const normalized = search.trim().toLowerCase();
  return inventory.filter((entry) => {
    const status = categorizeStatus(entry);
    if (statusFilter !== 'all' && status !== statusFilter) return false;
    if (!normalized) return true;
    const haystack = [entry.name, entry.dosage, entry.prescribedBy, entry.storage, entry.notes ?? '']
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalized);
  });
};

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export type InventorySummary = { total: number; expiring: number; expired: number; ok: number };

/** Compute aggregate status counts for an inventory list. */
export const summarizeInventory = (inventory: MedicationInventoryEntry[]): InventorySummary =>
  inventory.reduce<InventorySummary>(
    (acc, entry) => {
      const status = categorizeStatus(entry);
      if (status === 'expired') acc.expired += 1;
      else if (status === 'expiring') acc.expiring += 1;
      else acc.ok += 1;
      acc.total += 1;
      return acc;
    },
    { total: 0, expiring: 0, expired: 0, ok: 0 },
  );
