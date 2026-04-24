/**
 * Assignment Domain Pure Logic
 * 
 * Contains logic for conflict detection, capacity validation, and allocation rules.
 * These functions are pure and independent of UI or persistence layers.
 */

import { BaseAssignment, TransportAssignment, Assignment } from './types';

/**
 * Checks if two assignments overlap in time.
 * Standard (StartA < EndB) AND (StartB < EndA) logic.
 */
export function hasTimeConflict(a: BaseAssignment, b: BaseAssignment): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Checks if there is a resource conflict between two transport assignments.
 * A conflict occurs if they overlap in time and share the same vehicle or driver.
 */
export function detectTransportConflicts(
  a: TransportAssignment,
  b: TransportAssignment
): { conflict: boolean; reasons: string[] } {
  if (!hasTimeConflict(a, b)) {
    return { conflict: false, reasons: [] };
  }

  const reasons: string[] = [];

  if (a.vehicleId && b.vehicleId && a.vehicleId === b.vehicleId) {
    reasons.push(`Vehicle conflict: ${a.vehicleId} is assigned to both.`);
  }

  if (a.driverId && b.driverId && a.driverId === b.driverId) {
    reasons.push(`Driver conflict: ${a.driverId} is assigned to both.`);
  }

  return {
    conflict: reasons.length > 0,
    reasons,
  };
}

/**
 * Validates if a transport assignment exceeds the vehicle's capacity.
 */
export function checkCapacity(
  assignment: TransportAssignment,
  capacity: number
): { valid: boolean; over: number } {
  const passengerCount = assignment.userIds.length;
  if (passengerCount <= capacity) {
    return { valid: true, over: 0 };
  }
  return { valid: false, over: passengerCount - capacity };
}

/**
 * Checks if an assignment is owned by a specific user.
 * (Placeholder for future ownership/permission logic)
 */
export function isOwner(_assignment: Assignment, _userId: string): boolean {
  // In a real scenario, this might check a specific ownerId field
  // For now, we assume a simple check or expand BaseAssignment if needed.
  return true; 
}

/**
 * Groups assignments by a specific resource key (e.g., vehicleId).
 */
export function groupByResource<T extends Assignment>(
  assignments: T[],
  keySelector: (a: T) => string | undefined
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const a of assignments) {
    const key = keySelector(a);
    if (key) {
      if (!groups[key]) groups[key] = [];
      groups[key].push(a);
    }
  }
  return groups;
}
