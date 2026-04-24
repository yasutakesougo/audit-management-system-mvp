import { 
  TransportAssignmentDraft, 
  TransportAssignmentVehicleDraft,
  TransportAssignmentScheduleRow,
  buildTransportNotes,
  extractTransportAttendantStaffId,
  extractTransportCourseId,
  isSameDraftDate,
  normalizeText,
  toNullableLookupId,
  toScheduleCategory,
  toScheduleStatus,
  toScheduleVisibility,
} from '../domain/transportAssignmentDraft';
import type { TransportAssignment } from '@/features/schedules/domain/assignment/types';
import { detectTransportConflicts, checkCapacity } from '@/features/schedules/domain/assignment/logic';
import { UpdateScheduleEventInput } from '@/features/schedules/data/port';
import { inferTransportDirections, isTransportScheduleRow } from '@/features/today/transport/transportAssignments';
import { TransportCourse } from '@/features/today/transport/transportCourse';

/**
 * Adapter for connecting existing transport assignment state to the new domain models.
 * This allows using new pure logic (coordination, validation) within the existing UI.
 */

/**
 * Maps a single vehicle draft to the domain TransportAssignment model.
 */
export function mapVehicleDraftToDomain(
  vehicle: TransportAssignmentVehicleDraft,
  date: string,
  direction: 'to' | 'from'
): TransportAssignment {
  // Map 'to'/'from' to 'pickup'/'dropoff'
  const domainDirection = direction;
  
  // Create a stable ID for the assignment (not necessarily for persistence yet)
  const id = `transport-${date}-${direction}-${vehicle.vehicleId}`;

  return {
    id,
    type: 'transport',
    // For coordination logic, we use the date as the primary time indicator.
    // In the future, these would be specific schedule times.
    start: `${date}T08:00:00Z`,
    end: `${date}T10:00:00Z`,
    title: `送迎: ${vehicle.vehicleId}`,
    status: 'planned',
    vehicleId: vehicle.vehicleId || undefined,
    driverId: vehicle.driverStaffId || undefined,
    assistantStaffIds: vehicle.attendantStaffId ? [vehicle.attendantStaffId] : [],
    userIds: vehicle.riderUserIds,
    direction: domainDirection,
    // Note: capacityLimit is currently not in the draft, but we can pass it separately to logic
  };
}

/**
 * Maps the entire draft to an array of domain TransportAssignments.
 */
export function mapDraftToDomainAssignments(draft: TransportAssignmentDraft): TransportAssignment[] {
  return draft.vehicles.map(v => mapVehicleDraftToDomain(v, draft.date, draft.direction));
}

/**
 * High-level coordination result for a vehicle.
 */
export type VehicleCoordinationResult = {
  vehicleId: string;
  hasCapacityError: boolean;
  overCapacityCount: number;
  conflicts: string[];
};

/**
 * Evaluates the coordination state of a draft using new domain logic.
 * This is a 'read-only' adapter function that bridges the logic.
 */
export function evaluateDraftCoordination(
  draft: TransportAssignmentDraft,
  vehicleCapacities: Record<string, number> = {}
): VehicleCoordinationResult[] {
  const assignments = mapDraftToDomainAssignments(draft);
  
  return assignments.map((a, index) => {
    const vehicleId = a.vehicleId || 'unknown';
    const capacity = vehicleCapacities[vehicleId] ?? 10; // Default capacity if not provided
    
    // Check capacity
    const capacityResult = checkCapacity(a, capacity);
    
    // Check conflicts with OTHER assignments in the same draft
    // (In reality, we might also want to check against OTHER drafts/dates)
    const conflicts: string[] = [];
    assignments.forEach((other, otherIndex) => {
      if (index === otherIndex) return;
      const conflictResult = detectTransportConflicts(a, other);
      if (conflictResult.conflict) {
        conflicts.push(...conflictResult.reasons);
      }
    });

    return {
      vehicleId,
      hasCapacityError: !capacityResult.valid,
      overCapacityCount: capacityResult.over,
      conflicts,
    };
  });
}

/**
 * Write Bridge: Maps domain assignments and unassigned users back to persistence payloads.
 * This ensures the write path also flows through the domain concept conceptually.
 */
export function buildPersistencePayloadsFromDomain(
  assignments: TransportAssignment[],
  unassignedUserIds: string[],
  originalSchedules: TransportAssignmentScheduleRow[],
  date: string,
  direction: 'to' | 'from'
): UpdateScheduleEventInput[] {
  const assignmentByUserId = new Map<string, {
    vehicleId: string | null;
    courseId: TransportCourse | null;
    driverStaffId: string | null;
    attendantStaffId: string | null;
  }>();

  // Map assigned users
  for (const a of assignments) {
    for (const userId of a.userIds) {
      assignmentByUserId.set(userId, {
        vehicleId: a.vehicleId ?? null,
        // For now, we don't have courseId in TransportAssignment domain model,
        // so we might need to handle it carefully if it's required for persistence.
        // Actually, the new domain is thinner. If we want to support courses,
        // we'd need to add them to the domain model or pass them along.
        // For this bridge, we assume we might need to look them up if not in domain.
        courseId: null, // Placeholder or look up
        driverStaffId: a.driverId ?? null,
        attendantStaffId: a.assistantStaffIds[0] ?? null,
      });
    }
  }

  // Map unassigned users
  for (const userId of unassignedUserIds) {
    assignmentByUserId.set(userId, {
      vehicleId: null,
      courseId: null,
      driverStaffId: null,
      attendantStaffId: null,
    });
  }

  const payloads: UpdateScheduleEventInput[] = [];

  for (const row of originalSchedules) {
    if (!isSameDraftDate(row, date)) continue;
    const rawRow = row as unknown as Record<string, unknown>;
    if (!isTransportScheduleRow(rawRow)) continue;
    if (!inferTransportDirections(rawRow).includes(direction)) continue;

    const userId = normalizeText(row.userId);
    if (!userId) continue;

    const nextAssignment = assignmentByUserId.get(userId);
    if (!nextAssignment) continue;

    // ... (rest of the logic from buildSchedulePatchPayloads but using nextAssignment)
    // To keep it safe and identical for now, we'll use a very similar implementation.
    
    const nextVehicleId = nextAssignment.vehicleId ?? '';
    const nextDriverStaffId = nextAssignment.driverStaffId ?? '';
    const nextAttendantStaffId = nextAssignment.attendantStaffId ?? '';
    
    // Note: CourseId is a bit tricky since it's not yet in the domain model.
    // If we want functional parity, we should probably keep it in the bridge.
    const currentCourseId = extractTransportCourseId(row.notes) ?? '';
    const nextCourseId = nextAssignment.courseId ?? currentCourseId; // Keep current if not specified
    
    const currentVehicleId = normalizeText(row.vehicleId) ?? '';
    const currentDriverStaffId = normalizeText(row.assignedStaffId) ?? '';
    const currentAttendantStaffId = extractTransportAttendantStaffId(row.notes) ?? '';

    const nextNotes = buildTransportNotes(row.notes, nextAttendantStaffId, nextCourseId as TransportCourse);

    if (
      nextVehicleId === currentVehicleId
      && nextCourseId === currentCourseId
      && nextDriverStaffId === currentDriverStaffId
      && nextAttendantStaffId === currentAttendantStaffId
    ) {
      continue;
    }

    const etag = normalizeText(row.etag);
    const start = normalizeText(row.start);
    const end = normalizeText(row.end);
    if (!etag || !start || !end) continue;

    payloads.push({
      id: row.id,
      etag,
      title: normalizeText(row.title) ?? '送迎',
      category: toScheduleCategory(row.category),
      startLocal: start,
      endLocal: end,
      serviceType: normalizeText(row.serviceType) ?? undefined,
      userId,
      userLookupId: toNullableLookupId(row.userLookupId),
      userName: normalizeText(row.userName) ?? undefined,
      assignedStaffId: nextDriverStaffId,
      locationName: normalizeText(row.locationName) ?? undefined,
      notes: nextNotes,
      vehicleId: nextVehicleId,
      status: toScheduleStatus(row.status),
      statusReason: row.statusReason ?? null,
      acceptedOn: row.acceptedOn ?? null,
      acceptedBy: row.acceptedBy ?? null,
      acceptedNote: row.acceptedNote ?? null,
      ownerUserId: normalizeText(row.ownerUserId) ?? undefined,
      visibility: toScheduleVisibility(row.visibility),
      currentOwnerUserId: normalizeText(row.currentOwnerUserId) ?? undefined,
    });
  }

  return payloads;
}

/**
 * High-level helper that coordinates draft -> domain -> payloads.
 * This is the primary entry point for the Write Bridge in the existing UI.
 */
export function buildSchedulePatchPayloadsViaDomain(
  draft: TransportAssignmentDraft,
  originalSchedules: TransportAssignmentScheduleRow[]
): UpdateScheduleEventInput[] {
  const assignments = mapDraftToDomainAssignments(draft);
  return buildPersistencePayloadsFromDomain(
    assignments,
    draft.unassignedUserIds,
    originalSchedules,
    draft.date,
    draft.direction
  );
}
