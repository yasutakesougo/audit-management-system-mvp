/**
 * Schedules Domain Types — SSOT derived from Zod schemas
 *
 * All types are derived from schema.ts via z.infer.
 * Enum types are kept as simple string literal unions for ergonomics.
 */

import type { ScheduleCore, ScheduleDetail, ScheduleFull } from './schema';

// ─── Enum types (kept as simple literals for ergonomics) ────────────────────

export type ScheduleVisibility = 'org' | 'team' | 'private';
export type ScheduleCategory = 'User' | 'Staff' | 'Org';
export type ScheduleSource = 'sharepoint' | 'graph' | 'demo';
export type ScheduleStatus = 'Planned' | 'Postponed' | 'Cancelled';
export type ScheduleServiceType = 'absence' | 'late' | 'earlyLeave' | string;

// ─── Derived item types (SSOT = schema.ts) ──────────────────────────────────

/**
 * ScheduleItemCore — the canonical schedule item type.
 * Derived from ScheduleFullSchema (all fields).
 * Previously defined as a manual field-level type.
 */
export type ScheduleItemCore = ScheduleFull;

// Re-export for consumers who use the tier names directly
export type { ScheduleCore, ScheduleDetail, ScheduleFull };

// ─── Utilities ──────────────────────────────────────────────────────────────

export function normalizeVisibility(v?: string | null): ScheduleVisibility {
  if (v === 'org' || v === 'team' || v === 'private') return v;
  return 'team';
}
