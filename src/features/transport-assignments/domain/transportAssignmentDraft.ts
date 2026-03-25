import type { UpdateScheduleEventInput } from '@/features/schedules/data/port';
import {
  DEFAULT_TRANSPORT_VEHICLE_IDS,
  inferTransportDirections,
  isTransportScheduleRow,
} from '@/features/today/transport/transportAssignments';
import type { TransportDirection } from '@/features/today/transport/transportTypes';

export type TransportAssignmentScheduleRow = {
  id: string;
  etag?: string;
  title?: string;
  category?: string;
  start?: string;
  end?: string;
  serviceType?: string | null;
  userId?: string;
  userLookupId?: string | number;
  userName?: string;
  assignedStaffId?: string;
  assignedStaffName?: string;
  locationName?: string;
  notes?: string;
  vehicleId?: string;
  status?: string;
  statusReason?: string | null;
  acceptedOn?: string | null;
  acceptedBy?: string | null;
  acceptedNote?: string | null;
  ownerUserId?: string;
  visibility?: string;
  currentOwnerUserId?: string;
  hasPickup?: boolean;
};

export type TransportAssignmentUserSource = {
  userId: string;
  userName: string;
};

export type TransportAssignmentStaffSource = {
  id?: string | number;
  staffId?: string;
  name?: string;
};

export type TransportScheduleRef = {
  id: string;
  etag?: string;
};

export type TransportAssignmentDraftUser = {
  userId: string;
  userName: string;
  scheduleRefs: TransportScheduleRef[];
};

export type TransportAssignmentVehicleDraft = {
  vehicleId: string;
  driverStaffId: string | null;
  driverName: string | null;
  riderUserIds: string[];
};

export type TransportAssignmentDraft = {
  date: string;
  direction: TransportDirection;
  users: TransportAssignmentDraftUser[];
  vehicles: TransportAssignmentVehicleDraft[];
  unassignedUserIds: string[];
};

export type BuildTransportAssignmentDraftInput = {
  date: string;
  direction: TransportDirection;
  schedules: readonly TransportAssignmentScheduleRow[];
  users: readonly TransportAssignmentUserSource[];
  staff: readonly TransportAssignmentStaffSource[];
  fixedVehicleIds?: readonly string[];
};

export type BuildSchedulePatchPayloadsInput = {
  draft: TransportAssignmentDraft;
  schedules: readonly TransportAssignmentScheduleRow[];
};

type UserAssignment = {
  userId: string;
  userName: string;
  vehicleId: string | null;
  driverStaffId: string | null;
  driverName: string | null;
  scheduleRefs: TransportScheduleRef[];
};

type DriverAssignment = {
  vehicleId: string | null;
  driverStaffId: string | null;
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeLookupKey(value: string): string {
  return value.trim().replace(/[-_\s]/g, '').toUpperCase();
}

function compareVehicleId(a: string, b: string): number {
  const aNumber = /\d+/.exec(a);
  const bNumber = /\d+/.exec(b);
  if (aNumber && bNumber) {
    const delta = Number(aNumber[0]) - Number(bNumber[0]);
    if (delta !== 0) return delta;
  }
  return a.localeCompare(b, 'ja');
}

function sortUserIdsByName(userNameIndex: Map<string, string>, userIds: readonly string[]): string[] {
  return [...userIds].sort((a, b) =>
    (userNameIndex.get(a) ?? a).localeCompare((userNameIndex.get(b) ?? b), 'ja'),
  );
}

function normalizeFixedVehicleIds(fixedVehicleIds: readonly string[] | undefined): string[] {
  if (!fixedVehicleIds || fixedVehicleIds.length === 0) {
    return [...DEFAULT_TRANSPORT_VEHICLE_IDS];
  }
  return Array.from(
    new Set(
      fixedVehicleIds
        .map((vehicleId) => normalizeText(vehicleId))
        .filter((vehicleId): vehicleId is string => vehicleId !== null),
    ),
  );
}

function buildUserNameIndex(rows: readonly TransportAssignmentUserSource[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const row of rows) {
    const userId = normalizeText(row.userId);
    const userName = normalizeText(row.userName);
    if (!userId || !userName) continue;
    index.set(userId, userName);
  }
  return index;
}

function buildStaffNameIndex(rows: readonly TransportAssignmentStaffSource[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const row of rows) {
    const name = normalizeText(row.name);
    if (!name) continue;

    const staffId = normalizeText(row.staffId);
    if (staffId) {
      index.set(staffId, name);
      index.set(normalizeLookupKey(staffId), name);
    }

    if (typeof row.id === 'string' || typeof row.id === 'number') {
      const id = String(row.id);
      index.set(id, name);
      index.set(normalizeLookupKey(id), name);
    }
  }
  return index;
}

function resolveStaffName(
  staffId: string | null,
  fallbackName: string | null,
  staffNameIndex: Map<string, string>,
): string | null {
  if (fallbackName) return fallbackName;
  if (!staffId) return null;
  return staffNameIndex.get(staffId) ?? staffNameIndex.get(normalizeLookupKey(staffId)) ?? null;
}

function toScheduleRef(row: TransportAssignmentScheduleRow): TransportScheduleRef {
  return {
    id: row.id,
    etag: normalizeText(row.etag) ?? undefined,
  };
}

function buildUserNameIndexFromDraft(users: readonly TransportAssignmentDraftUser[]): Map<string, string> {
  return new Map(users.map((user) => [user.userId, user.userName] as const));
}

function toNullableLookupId(value: string | number | undefined): string | undefined {
  if (typeof value === 'number') return String(value);
  return normalizeText(value) ?? undefined;
}

function toScheduleCategory(value: string | undefined): UpdateScheduleEventInput['category'] {
  if (value === 'User' || value === 'Staff' || value === 'Org' || value === 'LivingSupport') {
    return value;
  }
  return 'User';
}

function toScheduleStatus(value: string | undefined): UpdateScheduleEventInput['status'] | undefined {
  if (value === 'Planned' || value === 'Postponed' || value === 'Cancelled') {
    return value;
  }
  return undefined;
}

function toScheduleVisibility(value: string | undefined): UpdateScheduleEventInput['visibility'] | undefined {
  if (value === 'org' || value === 'team' || value === 'private') {
    return value;
  }
  return undefined;
}

export function recomputeUnassignedUsers(
  draft: Pick<TransportAssignmentDraft, 'users' | 'vehicles'>,
): string[] {
  const assigned = new Set<string>();
  for (const vehicle of draft.vehicles) {
    for (const userId of vehicle.riderUserIds) {
      assigned.add(userId);
    }
  }
  const userNameIndex = buildUserNameIndexFromDraft(draft.users);
  const unassigned = draft.users
    .map((user) => user.userId)
    .filter((userId) => !assigned.has(userId));
  return sortUserIdsByName(userNameIndex, unassigned);
}

export function assignUserToVehicle(
  draft: TransportAssignmentDraft,
  userId: string,
  vehicleId: string,
): TransportAssignmentDraft {
  const normalizedUserId = normalizeText(userId);
  const normalizedVehicleId = normalizeText(vehicleId);
  if (!normalizedUserId || !normalizedVehicleId) return draft;

  const userExists = draft.users.some((user) => user.userId === normalizedUserId);
  if (!userExists) return draft;

  const nextVehicles = draft.vehicles.map((vehicle) => ({
    ...vehicle,
    riderUserIds: vehicle.riderUserIds.filter((id) => id !== normalizedUserId),
  }));

  const targetIndex = nextVehicles.findIndex((vehicle) => vehicle.vehicleId === normalizedVehicleId);
  if (targetIndex === -1) {
    nextVehicles.push({
      vehicleId: normalizedVehicleId,
      driverStaffId: null,
      driverName: null,
      riderUserIds: [normalizedUserId],
    });
  } else if (!nextVehicles[targetIndex].riderUserIds.includes(normalizedUserId)) {
    nextVehicles[targetIndex] = {
      ...nextVehicles[targetIndex],
      riderUserIds: [...nextVehicles[targetIndex].riderUserIds, normalizedUserId],
    };
  }

  const userNameIndex = buildUserNameIndexFromDraft(draft.users);
  const sortedVehicles = nextVehicles
    .map((vehicle) => ({
      ...vehicle,
      riderUserIds: sortUserIdsByName(userNameIndex, vehicle.riderUserIds),
    }))
    .sort((a, b) => compareVehicleId(a.vehicleId, b.vehicleId));

  const nextDraft: TransportAssignmentDraft = {
    ...draft,
    vehicles: sortedVehicles,
  };
  return {
    ...nextDraft,
    unassignedUserIds: recomputeUnassignedUsers(nextDraft),
  };
}

export function removeUserFromVehicle(
  draft: TransportAssignmentDraft,
  userId: string,
): TransportAssignmentDraft {
  const normalizedUserId = normalizeText(userId);
  if (!normalizedUserId) return draft;

  const nextVehicles = draft.vehicles.map((vehicle) => ({
    ...vehicle,
    riderUserIds: vehicle.riderUserIds.filter((id) => id !== normalizedUserId),
  }));

  const nextDraft: TransportAssignmentDraft = {
    ...draft,
    vehicles: nextVehicles,
  };
  return {
    ...nextDraft,
    unassignedUserIds: recomputeUnassignedUsers(nextDraft),
  };
}

export function hasVehicleMissingDriver(
  vehicle: Pick<TransportAssignmentVehicleDraft, 'driverStaffId' | 'driverName' | 'riderUserIds'>,
): boolean {
  if (vehicle.riderUserIds.length === 0) return false;
  return !normalizeText(vehicle.driverStaffId) && !normalizeText(vehicle.driverName);
}

export function buildTransportAssignmentDraft(input: BuildTransportAssignmentDraftInput): TransportAssignmentDraft {
  const fixedVehicleIds = normalizeFixedVehicleIds(input.fixedVehicleIds);
  const userNameIndex = buildUserNameIndex(input.users);
  const staffNameIndex = buildStaffNameIndex(input.staff);

  const assignments = new Map<string, UserAssignment>();

  for (const row of input.schedules) {
    const rawRow = row as unknown as Record<string, unknown>;
    if (!isTransportScheduleRow(rawRow)) continue;
    if (!inferTransportDirections(rawRow).includes(input.direction)) continue;

    const userId = normalizeText(row.userId);
    if (!userId) continue;

    const existing = assignments.get(userId);
    const userName =
      existing?.userName ??
      normalizeText(row.userName) ??
      userNameIndex.get(userId) ??
      userId;
    const vehicleId = existing?.vehicleId ?? normalizeText(row.vehicleId);
    const driverStaffId = existing?.driverStaffId ?? normalizeText(row.assignedStaffId);
    const driverName = resolveStaffName(
      driverStaffId ?? null,
      existing?.driverName ?? normalizeText(row.assignedStaffName),
      staffNameIndex,
    );
    const scheduleRefs = [...(existing?.scheduleRefs ?? []), toScheduleRef(row)];

    assignments.set(userId, {
      userId,
      userName,
      vehicleId: vehicleId ?? null,
      driverStaffId: driverStaffId ?? null,
      driverName,
      scheduleRefs,
    });
  }

  const users = [...assignments.values()]
    .map<TransportAssignmentDraftUser>((assignment) => ({
      userId: assignment.userId,
      userName: assignment.userName,
      scheduleRefs: assignment.scheduleRefs,
    }))
    .sort((a, b) => a.userName.localeCompare(b.userName, 'ja'));

  const vehicles = new Map<string, TransportAssignmentVehicleDraft>();
  for (const vehicleId of fixedVehicleIds) {
    vehicles.set(vehicleId, {
      vehicleId,
      driverStaffId: null,
      driverName: null,
      riderUserIds: [],
    });
  }

  for (const assignment of users) {
    const state = assignments.get(assignment.userId);
    if (!state?.vehicleId) continue;

    const currentVehicle = vehicles.get(state.vehicleId);
    if (!currentVehicle) {
      vehicles.set(state.vehicleId, {
        vehicleId: state.vehicleId,
        driverStaffId: state.driverStaffId,
        driverName: state.driverName,
        riderUserIds: [assignment.userId],
      });
      continue;
    }

    currentVehicle.riderUserIds.push(assignment.userId);
    if (!currentVehicle.driverStaffId && state.driverStaffId) {
      currentVehicle.driverStaffId = state.driverStaffId;
    }
    if (!currentVehicle.driverName && state.driverName) {
      currentVehicle.driverName = state.driverName;
    }
  }

  const sortedVehicles = [...vehicles.values()]
    .map((vehicle) => ({
      ...vehicle,
      riderUserIds: sortUserIdsByName(userNameIndex, vehicle.riderUserIds),
    }))
    .sort((a, b) => compareVehicleId(a.vehicleId, b.vehicleId));

  const draft: TransportAssignmentDraft = {
    date: input.date,
    direction: input.direction,
    users,
    vehicles: sortedVehicles,
    unassignedUserIds: [],
  };

  return {
    ...draft,
    unassignedUserIds: recomputeUnassignedUsers(draft),
  };
}

export function buildSchedulePatchPayloads(input: BuildSchedulePatchPayloadsInput): UpdateScheduleEventInput[] {
  const assignmentByUserId = new Map<string, DriverAssignment>();

  for (const vehicle of input.draft.vehicles) {
    for (const userId of vehicle.riderUserIds) {
      assignmentByUserId.set(userId, {
        vehicleId: vehicle.vehicleId,
        driverStaffId: vehicle.driverStaffId,
      });
    }
  }

  for (const userId of input.draft.unassignedUserIds) {
    assignmentByUserId.set(userId, {
      vehicleId: null,
      driverStaffId: null,
    });
  }

  const payloads: UpdateScheduleEventInput[] = [];

  for (const row of input.schedules) {
    const rawRow = row as unknown as Record<string, unknown>;
    if (!isTransportScheduleRow(rawRow)) continue;
    if (!inferTransportDirections(rawRow).includes(input.draft.direction)) continue;

    const userId = normalizeText(row.userId);
    if (!userId) continue;

    const nextAssignment = assignmentByUserId.get(userId);
    if (!nextAssignment) continue;

    const nextVehicleId = nextAssignment.vehicleId ?? '';
    const nextDriverStaffId = nextAssignment.driverStaffId ?? '';
    const currentVehicleId = normalizeText(row.vehicleId) ?? '';
    const currentDriverStaffId = normalizeText(row.assignedStaffId) ?? '';

    if (nextVehicleId === currentVehicleId && nextDriverStaffId === currentDriverStaffId) {
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
      notes: normalizeText(row.notes) ?? undefined,
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
