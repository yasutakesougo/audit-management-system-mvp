import { z } from 'zod';

/**
 * Assignment Domain Types
 * 
 * This domain handles the coordination and allocation of resources.
 * Distinct from 'Schedule' which represents the time-slot, 'Assignment' 
 * represents the specific mapping of resources (staff, vehicles, rooms) to needs.
 */

export const AssignmentStatusSchema = z.enum(['planned', 'confirmed', 'cancelled']);
export const AssignmentTypeSchema = z.enum(['transport', 'support', 'staff', 'resource']);

export const BaseAssignmentSchema = z.object({
  id: z.string(),
  type: AssignmentTypeSchema,
  start: z.string(), // ISO 8601
  end: z.string(),   // ISO 8601
  title: z.string(),
  notes: z.string().optional(),
  status: AssignmentStatusSchema,
  updatedAt: z.string().optional(),
  etag: z.string().optional(),
});

/**
 * Transport Assignment
 * Specific to vehicle and driver allocation for user pickup/dropoff.
 */
export const TransportAssignmentSchema = BaseAssignmentSchema.extend({
  type: z.literal('transport'),
  vehicleId: z.string().optional(),
  driverId: z.string().optional(),
  assistantStaffIds: z.array(z.string()).default([]),
  userIds: z.array(z.string()).default([]),
  routeId: z.string().optional(),
  direction: z.enum(['pickup', 'dropoff']),
  capacityLimit: z.number().optional(),
});

export type AssignmentStatus = z.infer<typeof AssignmentStatusSchema>;
export type AssignmentType = z.infer<typeof AssignmentTypeSchema>;
export type BaseAssignment = z.infer<typeof BaseAssignmentSchema>;
export type TransportAssignment = z.infer<typeof TransportAssignmentSchema>;

/**
 * Union of all assignment types for domain operations.
 */
export const AssignmentSchema = z.discriminatedUnion('type', [
  TransportAssignmentSchema,
  // Add other schemas as they are defined (support, staff, etc.)
  BaseAssignmentSchema.extend({ type: z.literal('support') }),
  BaseAssignmentSchema.extend({ type: z.literal('staff') }),
  BaseAssignmentSchema.extend({ type: z.literal('resource') }),
]);

export type Assignment = z.infer<typeof AssignmentSchema>;
