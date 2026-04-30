/**
 * Schedules Zod Schema — SSOT for schedule data validation and type derivation
 *
 * 3-tier hierarchy:
 * - ScheduleCoreSchema:   Minimum for calendar/list rendering (id, title, start, end, ...)
 * - ScheduleDetailSchema: Detail view (Core + user/staff assignment + approval)
 * - ScheduleFullSchema:   Admin/export (Detail + metadata + timestamps + source)
 *
 * Usage:
 *   import { ScheduleCoreSchema, type ScheduleCore } from '@/features/schedules/domain/schema';
 *   const parsed = ScheduleCoreSchema.parse(rawData);
 */

import { z } from 'zod';

// ─── Enum Schemas ───────────────────────────────────────────────────────────

export const ScheduleVisibilitySchema = z.enum(['org', 'team', 'private']);
export const ScheduleCategorySchema = z.enum(['User', 'Staff', 'Org', 'LivingSupport']);
export const ScheduleSourceSchema = z.enum(['sharepoint', 'graph', 'demo']);
export const ScheduleStatusSchema = z.enum(['Planned', 'Postponed', 'Cancelled']);

// ScheduleServiceType allows known values + arbitrary strings
export const ScheduleServiceTypeSchema = z.union([
  z.enum(['absence', 'late', 'earlyLeave', 'preAbsence']),
  z.string(),
]);

// ─── Core Schema ────────────────────────────────────────────────────────────
// Minimum fields for calendar/list rendering

export const ScheduleCoreSchema = z.object({
  id: z.string(),
  title: z.string(),
  start: z.string(),           // ISO 8601
  end: z.string(),             // ISO 8601
  category: ScheduleCategorySchema.optional(),
  allDay: z.boolean().optional(),
  status: ScheduleStatusSchema.optional(),
  etag: z.string(),
});

// ─── Detail Schema ──────────────────────────────────────────────────────────
// Core + user/staff assignment + approval + display fields

export const ScheduleDetailSchema = ScheduleCoreSchema.extend({
  // Display
  visibility: ScheduleVisibilitySchema.optional(),
  location: z.string().optional(),
  locationName: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),

  // User/staff assignment
  userId: z.string().nullable().optional(),
  userLookupId: z.union([z.string(), z.number(), z.null()]).optional(),
  userName: z.string().nullable().optional(),
  assignedStaffId: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  vehicleId: z.string().nullable().optional(),

  // Approval/acceptance
  acceptedOn: z.string().nullable().optional(),
  acceptedBy: z.string().nullable().optional(),
  acceptedNote: z.string().nullable().optional(),

  // Status detail
  statusReason: z.string().nullable().optional(),
  statusLabel: z.string().optional(),
  serviceType: ScheduleServiceTypeSchema.nullable().optional(),
  subType: z.string().optional(),
});

// ─── Full Schema ────────────────────────────────────────────────────────────
// Detail + metadata + source + timestamps (admin/export)

export const ScheduleFullSchema = ScheduleDetailSchema.extend({
  source: ScheduleSourceSchema.optional(),
  updatedAt: z.string().optional(),
  createdAt: z.string().optional(),
  entryHash: z.string().optional(),
  ownerUserId: z.string().optional(),
  staffNames: z.array(z.string()).optional(),
});

// ─── Derived Types ──────────────────────────────────────────────────────────

export type ScheduleCore = z.infer<typeof ScheduleCoreSchema>;
export type ScheduleDetail = z.infer<typeof ScheduleDetailSchema>;
export type ScheduleFull = z.infer<typeof ScheduleFullSchema>;

// ─── Create/Update Input Schemas ────────────────────────────────────────────

export const CreateScheduleInputSchema = z.object({
  title: z.string(),
  category: ScheduleCategorySchema,
  startLocal: z.string(),
  endLocal: z.string(),
  serviceType: z.string().nullable().optional(),
  userId: z.string().nullable().optional(),
  userLookupId: z.string().nullable().optional(),
  userName: z.string().nullable().optional(),
  assignedStaffId: z.string().nullable().optional(),
  locationName: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  vehicleId: z.string().nullable().optional(),
  status: ScheduleStatusSchema.optional(),
  statusReason: z.string().nullable().optional(),
  acceptedOn: z.string().nullable().optional(),
  acceptedBy: z.string().nullable().optional(),
  acceptedNote: z.string().nullable().optional(),
  ownerUserId: z.string().optional(),
  visibility: ScheduleVisibilitySchema.optional(),
  currentOwnerUserId: z.string().optional(),
  // SP adapter fields — needed for SharePoint list item creation/update
  targetUserId: z.string().optional(),
  orgAudience: z.string().optional(),
  rowKey: z.string().optional(),
});

export const UpdateScheduleInputSchema = CreateScheduleInputSchema.partial().extend({
  id: z.string(),
  etag: z.string().optional(),
});

export type CreateScheduleInputZ = z.infer<typeof CreateScheduleInputSchema>;
export type UpdateScheduleInputZ = z.infer<typeof UpdateScheduleInputSchema>;
