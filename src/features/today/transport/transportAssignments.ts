import { normalizeServiceType } from '@/features/schedules/serviceTypeMetadata';
import type { TransportDirection, TransportLeg } from './transportTypes';

export type TransportAssignment = {
  vehicleId?: string;
  driverName?: string;
};

export type TransportAssignmentIndex = Record<TransportDirection, Map<string, TransportAssignment>>;

export type TransportVehicleGroup = {
  vehicleId: string;
  driverName: string | null;
  riders: TransportLeg[];
};

export const DEFAULT_TRANSPORT_VEHICLE_IDS = ['車両1', '車両2', '車両3', '車両4'] as const;

const TO_PATTERNS = /(往路|迎え|行き|登所)/;
const FROM_PATTERNS = /(復路|送り|帰り|退所)/;
const TRANSPORT_TITLE_PATTERNS = /(送迎|迎え|送り|往路|復路)/;
const UNASSIGNED_VEHICLE_LABEL = '未割当';

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeUserLookupKey(value: string): string {
  return value.trim().replace(/[-_\s]/g, '').toUpperCase();
}

function buildUserLookupKeys(value: string | undefined): string[] {
  const raw = normalizeText(value);
  if (!raw) return [];
  const normalized = normalizeUserLookupKey(raw);
  return normalized === raw ? [raw] : [raw, normalized];
}

function pickBoolean(value: unknown): boolean {
  return value === true;
}

function parseHour(value: string | undefined): number | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours();
}

function createEmptyIndex(): TransportAssignmentIndex {
  return {
    to: new Map<string, TransportAssignment>(),
    from: new Map<string, TransportAssignment>(),
  };
}

export function isTransportScheduleRow(row: Record<string, unknown>): boolean {
  const serviceType = normalizeText(row.serviceType);
  const title = normalizeText(row.title);
  const hasPickup = pickBoolean(row.hasPickup);

  if (serviceType && normalizeServiceType(serviceType) === 'transport') {
    return true;
  }
  if (hasPickup) {
    return true;
  }
  return title ? TRANSPORT_TITLE_PATTERNS.test(title) : false;
}

export function inferTransportDirections(row: Record<string, unknown>): TransportDirection[] {
  const title = normalizeText(row.title) ?? '';
  if (TO_PATTERNS.test(title)) return ['to'];
  if (FROM_PATTERNS.test(title)) return ['from'];

  if (pickBoolean(row.hasPickup)) {
    return ['to', 'from'];
  }

  const hour = parseHour(normalizeText(row.start));
  if (hour !== null) {
    return hour >= 13 ? ['from'] : ['to'];
  }

  return ['to', 'from'];
}

function mergeAssignment(
  current: TransportAssignment | undefined,
  incoming: TransportAssignment,
): TransportAssignment {
  if (!current) return incoming;
  return {
    vehicleId: current.vehicleId ?? incoming.vehicleId,
    driverName: current.driverName ?? incoming.driverName,
  };
}

export function buildTransportAssignmentIndex(
  rows: readonly Record<string, unknown>[],
  resolveStaffName: (staffId: string) => string | undefined,
): TransportAssignmentIndex {
  const index = createEmptyIndex();

  for (const row of rows) {
    if (!isTransportScheduleRow(row)) continue;

    const userId = normalizeText(row.userId);
    if (!userId) continue;

    const vehicleId = normalizeText(row.vehicleId);
    const assignedStaffName = normalizeText(row.assignedStaffName);
    const assignedStaffId = normalizeText(row.assignedStaffId);
    const driverName = assignedStaffName ?? (assignedStaffId ? resolveStaffName(assignedStaffId) : undefined);

    if (!vehicleId && !driverName) continue;

    const incoming: TransportAssignment = {
      vehicleId,
      driverName,
    };

    for (const direction of inferTransportDirections(row)) {
      const map = index[direction];
      for (const lookupKey of buildUserLookupKeys(userId)) {
        const merged = mergeAssignment(map.get(lookupKey), incoming);
        map.set(lookupKey, merged);
      }
    }
  }

  return index;
}

export function enrichTransportLegsWithAssignments(
  legs: readonly TransportLeg[],
  assignments: TransportAssignmentIndex,
): TransportLeg[] {
  return legs.map((leg) => {
    const directionMap = assignments[leg.direction];
    const assignment =
      directionMap.get(leg.userId) ??
      directionMap.get(normalizeUserLookupKey(leg.userId));
    if (!assignment) return leg;

    return {
      ...leg,
      vehicleId: leg.vehicleId ?? assignment.vehicleId,
      driverName: leg.driverName ?? assignment.driverName,
    };
  });
}

function compareVehicleId(a: string, b: string): number {
  if (a === UNASSIGNED_VEHICLE_LABEL) return 1;
  if (b === UNASSIGNED_VEHICLE_LABEL) return -1;

  const aNumber = /\d+/.exec(a);
  const bNumber = /\d+/.exec(b);
  if (aNumber && bNumber) {
    const delta = Number(aNumber[0]) - Number(bNumber[0]);
    if (delta !== 0) return delta;
  }
  return a.localeCompare(b, 'ja');
}

export function buildVehicleGroups(legs: readonly TransportLeg[]): TransportVehicleGroup[] {
  const grouped = new Map<string, TransportVehicleGroup>();

  for (const leg of legs) {
    if (leg.status === 'self' || leg.status === 'absent') continue;

    const vehicleId = leg.vehicleId?.trim() || UNASSIGNED_VEHICLE_LABEL;
    const existing = grouped.get(vehicleId);

    if (!existing) {
      grouped.set(vehicleId, {
        vehicleId,
        driverName: leg.driverName?.trim() || null,
        riders: [leg],
      });
      continue;
    }

    existing.riders.push(leg);
    if (!existing.driverName) {
      existing.driverName = leg.driverName?.trim() || null;
    }
  }

  return Array.from(grouped.values())
    .map((group) => ({
      ...group,
      riders: [...group.riders].sort((a, b) => a.userName.localeCompare(b.userName, 'ja')),
    }))
    .sort((a, b) => compareVehicleId(a.vehicleId, b.vehicleId));
}

export function buildVehicleBoardGroups(
  legs: readonly TransportLeg[],
  fixedVehicleIds: readonly string[] = DEFAULT_TRANSPORT_VEHICLE_IDS,
): TransportVehicleGroup[] {
  const groups = buildVehicleGroups(legs);
  const groupMap = new Map(groups.map((group) => [group.vehicleId, group] as const));
  const fixedIds = Array.from(new Set(fixedVehicleIds.map((id) => id.trim()).filter(Boolean)));
  const fixedIdSet = new Set(fixedIds);

  const rows: TransportVehicleGroup[] = fixedIds.map((vehicleId) => {
    const group = groupMap.get(vehicleId);
    return group ?? { vehicleId, driverName: null, riders: [] };
  });

  const extraRows = groups
    .filter((group) => group.vehicleId !== UNASSIGNED_VEHICLE_LABEL)
    .filter((group) => !fixedIdSet.has(group.vehicleId));
  const unassignedRow = groups.find((group) => group.vehicleId === UNASSIGNED_VEHICLE_LABEL);

  return [
    ...rows,
    ...extraRows,
    ...(unassignedRow ? [unassignedRow] : []),
  ];
}

export function hasMissingVehicleDriver(group: Pick<TransportVehicleGroup, 'driverName' | 'riders'>): boolean {
  return group.riders.length > 0 && !group.driverName;
}
