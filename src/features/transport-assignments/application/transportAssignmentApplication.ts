import { 
  TransportAssignmentDraft, 
  TransportAssignmentScheduleRow,
  TransportAssignmentUserSource,
  TransportAssignmentStaffSource,
  buildTransportAssignmentDraft,
  applyPreviousWeekdayDefaults,
} from '../domain/transportAssignmentDraft';
import { AssignmentRepository } from '@/features/schedules/domain/assignment';
import { 
  evaluateDraftCoordination, 
  buildSchedulePatchPayloadsViaDomain,
  mapDraftToDomainAssignments
} from '../adapters/assignmentAdapter';
import { resolveTransportVehicleName, TransportVehicleNameOverrides } from '@/features/today/transport/transportVehicleNames';
import { DEFAULT_TRANSPORT_VEHICLE_IDS } from '@/features/today/transport/transportAssignments';
import { TransportDirection } from '@/features/today/transport/transportTypes';
import { UpdateScheduleEventInput } from '@/features/schedules/data/port';
import { TransportAssignment } from '@/features/schedules/domain/assignment';
import { hasVehicleMissingDriver } from '../domain/transportAssignmentDraft';

/**
 * Orchestrates the saving of transport assignments from a draft.
 */
export async function orchestrateAssignmentSave(
  repo: AssignmentRepository,
  draft: TransportAssignmentDraft
): Promise<void> {
  const assignments = mapDraftToDomainAssignments(draft);
  await repo.saveBulk(assignments);
}

/**
 * Application Layer for Transport Assignments.
 * Orchestrates domain logic, adapters, and UI-specific business rules.
 */

export type CoordinationInsight = {
  type: 'capacity' | 'conflict' | 'missing_driver';
  severity: 'error' | 'warning';
  message: string;
};

/**
 * Orchestrates coordination evaluation and generates user-friendly insights.
 */
export function getTransportAssignmentInsights(
  draft: TransportAssignmentDraft,
  vehicleNameOverrides: TransportVehicleNameOverrides,
  vehicleCapacities: Record<string, number> = {}
): CoordinationInsight[] {
  const insights: CoordinationInsight[] = [];

  // 1. Check Missing Drivers (Legacy check moved to application layer)
  const missingDriverVehicleIds = draft.vehicles
    .filter((vehicle) => hasVehicleMissingDriver(vehicle))
    .map((vehicle) => resolveTransportVehicleName(vehicle.vehicleId, vehicleNameOverrides));

  if (missingDriverVehicleIds.length > 0) {
    insights.push({
      type: 'missing_driver',
      severity: 'warning',
      message: `乗車利用者がいる車両で運転者が未設定です: ${missingDriverVehicleIds.join('、')}`
    });
  }

  // 2. Check Coordination (Conflicts & Capacity via new domain logic)
  const coordinationResults = evaluateDraftCoordination(draft, vehicleCapacities);

  // Capacity warnings
  const capacityErrors = coordinationResults.filter(r => r.hasCapacityError);
  if (capacityErrors.length > 0) {
    const names = capacityErrors.map(w => 
      `${resolveTransportVehicleName(w.vehicleId, vehicleNameOverrides)} (${w.overCapacityCount}名オーバー)`
    ).join('、');
    insights.push({
      type: 'capacity',
      severity: 'error',
      message: `車両の定員を超過しています: ${names}`
    });
  }

  // Conflict warnings
  const conflicts = coordinationResults.flatMap(r => r.conflicts);
  if (conflicts.length > 0) {
    insights.push({
      type: 'conflict',
      severity: 'error',
      message: `調整上の競合が検出されました: ${conflicts.join('、')}`
    });
  }

  return insights;
}


/**
 * Result of a week-bulk application operation.
 */
export type WeekBulkApplyResult = {
  nextDraft: TransportAssignmentDraft;
  assignments: TransportAssignment[];
  payloads: UpdateScheduleEventInput[];
  summary: { date: string; count: number }[];
};

/**
 * Summary of differences between draft and persisted state.
 */
export type AssignmentDiff = {
  vehicleId: string;
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  userChanges?: { added: string[], removed: string[] };
};

/**
 * Compares current UI draft with the persisted assignments from the repository.
 */
export function compareDraftWithPersistedAssignments(
  draft: TransportAssignmentDraft,
  persisted: TransportAssignment[] | null
): AssignmentDiff[] {
  const diffs: AssignmentDiff[] = [];
  if (!persisted) return [];
  const persistedMap = new Map(persisted.map(a => [a.vehicleId || 'unassigned', a]));

  // 1. Check vehicles in draft
  for (const vehicle of draft.vehicles) {
    const vId = vehicle.vehicleId || 'unassigned';
    const p = persistedMap.get(vId);

    if (!p) {
      if (vehicle.riderUserIds.length > 0) {
        diffs.push({ vehicleId: vId, type: 'added' });
      }
    } else {
      const added = vehicle.riderUserIds.filter(id => !p.userIds.includes(id));
      const removed = p.userIds.filter(id => !vehicle.riderUserIds.includes(id));

      if (added.length > 0 || removed.length > 0 || vehicle.driverStaffId !== p.driverId) {
        diffs.push({
          vehicleId: vId,
          type: 'modified',
          userChanges: { added, removed }
        });
      }
    }
    persistedMap.delete(vId);
  }

  // 2. Remaining in persistedMap were removed in draft
  for (const [vId, p] of persistedMap.entries()) {
    if (p.userIds.length > 0) {
      diffs.push({ vehicleId: vId, type: 'removed' });
    }
  }

  return diffs;
}

/**
 * Summary of a concurrency conflict.
 */
export type ConcurrencyConflictInsight = {
  vehicleId: string;
  vehicleName: string;
  reason: 'modified_externally';
};

/**
 * Detects if persisted assignments have changed since a snapshot was taken.
 */
export function detectConcurrencyConflicts(
  initial: TransportAssignment[] | null,
  latest: TransportAssignment[] | null,
  vehicleNameOverrides: TransportVehicleNameOverrides
): ConcurrencyConflictInsight[] {
  if (!initial || !latest) return [];
  const initialMap = new Map(initial.map(a => [a.id, a.etag]));
  const conflicts: ConcurrencyConflictInsight[] = [];

  for (const l of latest) {
    const initialEtag = initialMap.get(l.id);
    if (initialEtag && l.etag && initialEtag !== l.etag) {
      conflicts.push({
        vehicleId: l.vehicleId || 'unassigned',
        vehicleName: resolveTransportVehicleName(l.vehicleId || 'unassigned', vehicleNameOverrides),
        reason: 'modified_externally'
      });
    }
  }

  return conflicts;
}

/**
 * Save readiness state.
 */
export type SaveReadiness = {
  isBlocked: boolean;
  blockReason?: 'concurrency_conflict' | 'coordination_error';
  warnings: string[];
};

/**
 * Validates if the current state is ready for saving.
 */
export function validateSaveReadiness(
  insights: CoordinationInsight[],
  concurrencyConflicts: ConcurrencyConflictInsight[]
): SaveReadiness {
  const hasErrors = insights.some(i => i.severity === 'error');
  const hasConflicts = concurrencyConflicts.length > 0;

  return {
    isBlocked: hasErrors || hasConflicts,
    blockReason: hasErrors ? 'coordination_error' : (hasConflicts ? 'concurrency_conflict' : undefined),
    warnings: insights.filter(i => i.severity === 'warning').map(i => i.message)
  };
}

/**
 * Orchestrates the logic for applying default assignments to an entire week.
 */
export function orchestrateWeekBulkApply(params: {
  targetDate: string;
  direction: TransportDirection;
  weekdayDefaultDraft: TransportAssignmentDraft;
  scheduleRows: TransportAssignmentScheduleRow[];
  userSources: TransportAssignmentUserSource[];
  staffSources: TransportAssignmentStaffSource[];
  weekDateOptions: { date: string }[];
}): WeekBulkApplyResult {
  const { 
    targetDate, 
    direction, 
    weekdayDefaultDraft, 
    scheduleRows, 
    userSources, 
    staffSources, 
    weekDateOptions 
  } = params;

  const payloadMap = new Map<string, UpdateScheduleEventInput>();
  const allAssignments: TransportAssignment[] = [];
  const summary = weekDateOptions.map((option) => {
    const dayRows = scheduleRows.filter((row) => {
      // Manual check to avoid circular dependency if possible, but we already import helpers
      // We'll assume a simplified check here or use the domain helper if available
      return row.start?.startsWith(option.date);
    });

    const baseDraftForDate =
      option.date === targetDate
        ? weekdayDefaultDraft
        : buildTransportAssignmentDraft({
            date: option.date,
            direction,
            schedules: dayRows,
            users: userSources,
            staff: staffSources,
            fixedVehicleIds: DEFAULT_TRANSPORT_VEHICLE_IDS,
          });

    const appliedDraftForDate = applyPreviousWeekdayDefaults({
      draft: baseDraftForDate,
      schedules: scheduleRows,
      users: userSources,
    });

    const dayPayloads = buildSchedulePatchPayloadsViaDomain(appliedDraftForDate, dayRows);
    for (const payload of dayPayloads) {
      payloadMap.set(payload.id, payload);
    }

    const dayAssignments = mapDraftToDomainAssignments(appliedDraftForDate);
    allAssignments.push(...dayAssignments);

    return {
      date: option.date,
      count: dayPayloads.length,
    };
  });

  return {
    nextDraft: weekdayDefaultDraft,
    assignments: allAssignments,
    payloads: [...payloadMap.values()],
    summary,
  };
}
