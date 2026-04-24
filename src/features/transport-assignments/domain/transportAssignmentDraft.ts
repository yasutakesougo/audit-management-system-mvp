import type { UpdateScheduleEventInput } from '@/features/schedules/data/port';
import {
  DEFAULT_TRANSPORT_VEHICLE_IDS,
  inferTransportDirections,
  isTransportScheduleRow,
} from '@/features/today/transport/transportAssignments';
import {
  getTransportCourseLabel,
  parseTransportCourse,
  type TransportCourse,
} from '@/features/today/transport/transportCourse';
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

export type AssignmentChange<T = string> =
  | { kind: 'no-change' }
  | { kind: 'assign'; value: T }
  | { kind: 'unassign' };

/**
 * AssignmentChange をリポジトリ契約（UpdateScheduleEventInput）で期待される
 * 正規化された値に変換する。
 * - assign: value
 * - unassign: '' (Repositoryでnullに正規化される)
 * - no-change: undefined (PATCH対象外)
 */
export function toAssignmentContractValue<T>(
  change: AssignmentChange<T>,
): T | '' | undefined {
  switch (change.kind) {
    case 'assign':
      return change.value;
    case 'unassign':
      return '';
    case 'no-change':
      return undefined;
  }
}

/**
 * 生の入力値（string | null | undefined）を AssignmentChange ADT に変換する。
 * 空文字や null/undefined は 'unassign' とみなす。
 */
export function toAssignmentChange<T = string>(
  value: T | null | undefined,
): AssignmentChange<T> {
  if (value === undefined || value === null) return { kind: 'unassign' };
  if (typeof value === 'string' && value.trim().length === 0) return { kind: 'unassign' };
  return { kind: 'assign', value };
}

export type TransportAssignmentUserSource = {
  userId: string;
  userName: string;
  fixedCourseId?: TransportCourse | null;
  fixedCourseLabel?: string | null;
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
  courseId: TransportCourse | null;
  courseLabel: string | null;
  driverStaffId: string | null;
  driverName: string | null;
  attendantStaffId: string | null;
  attendantName: string | null;
  riderUserIds: string[];
};

export type TransportAssignmentDraft = {
  date: string;
  direction: TransportDirection;
  users: TransportAssignmentDraftUser[];
  vehicles: TransportAssignmentVehicleDraft[];
  unassignedUserIds: string[];
};

export type VehicleAssignmentField = 'driver' | 'attendant' | 'course';

/**
 * 送迎配車ドラフトの特定車両の割り当て（運転手、添乗員、コース）を更新する。
 * AssignmentChange ADT を使用することで、割り当て・解除・変更なしを構造的に扱う。
 */
export function updateVehicleAssignment(
  draft: TransportAssignmentDraft,
  vehicleId: string,
  field: VehicleAssignmentField,
  change: AssignmentChange,
  staffNameIndex?: Map<string, string>,
): TransportAssignmentDraft {
  const nextVehicles = draft.vehicles.map((v) => {
    if (v.vehicleId !== vehicleId) return v;

    switch (field) {
      case 'driver': {
        if (change.kind === 'no-change') return v;
        const driverId = change.kind === 'assign' ? change.value : null;
        return {
          ...v,
          driverStaffId: driverId,
          driverName: driverId ? (staffNameIndex?.get(driverId) ?? null) : null,
        };
      }
      case 'attendant': {
        if (change.kind === 'no-change') return v;
        const attendantId = change.kind === 'assign' ? change.value : null;
        return {
          ...v,
          attendantStaffId: attendantId,
          attendantName: attendantId ? (staffNameIndex?.get(attendantId) ?? null) : null,
        };
      }
      case 'course': {
        if (change.kind === 'no-change') return v;
        const courseId = change.kind === 'assign' ? parseTransportCourse(change.value) : null;
        return {
          ...v,
          courseId,
          courseLabel: getTransportCourseLabel(courseId),
        };
      }
      default:
        return v;
    }
  });

  const nextDraft = { ...draft, vehicles: nextVehicles };
  return {
    ...nextDraft,
    unassignedUserIds: recomputeUnassignedUsers(nextDraft),
  };
}

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

export type ApplyPreviousWeekdayDefaultsInput = {
  draft: TransportAssignmentDraft;
  schedules: readonly TransportAssignmentScheduleRow[];
  users?: readonly TransportAssignmentUserSource[];
};

type UserAssignment = {
  userId: string;
  userName: string;
  vehicleId: string | null;
  courseId: TransportCourse | null;
  courseLabel: string | null;
  driverStaffId: string | null;
  driverName: string | null;
  attendantStaffId: string | null;
  attendantName: string | null;
  scheduleRefs: TransportScheduleRef[];
};

type CrewAssignment = {
  vehicleId: string | null;
  courseId: TransportCourse | null;
  driverStaffId: string | null;
  attendantStaffId: string | null;
};

const TRANSPORT_ATTENDANT_TAG_PATTERN = /\[transport_attendant:([^\]\r\n]+)\]/i;
const TRANSPORT_ATTENDANT_TAG_PATTERN_GLOBAL = /\[transport_attendant:[^\]\r\n]+\]/gi;
const TRANSPORT_COURSE_TAG_PATTERN = /\[transport_course:([^\]\r\n]+)\]/i;
const TRANSPORT_COURSE_TAG_PATTERN_GLOBAL = /\[transport_course:[^\]\r\n]+\]/gi;
const TRANSPORT_TZ = 'Asia/Tokyo';
const TRANSPORT_NOON_SUFFIX = 'T12:00:00+09:00';

export function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeLookupKey(value: string): string {
  return value.trim().replace(/[-_\s]/g, '').toUpperCase();
}

function stripTransportMetaTags(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const stripped = value
    .replace(TRANSPORT_ATTENDANT_TAG_PATTERN_GLOBAL, '')
    .replace(TRANSPORT_COURSE_TAG_PATTERN_GLOBAL, '')
    .trim();
  return stripped.length > 0 ? stripped : null;
}

export function extractTransportAttendantStaffId(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const match = TRANSPORT_ATTENDANT_TAG_PATTERN.exec(value);
  return normalizeText(match?.[1]);
}

export function extractTransportCourseId(value: string | null | undefined): TransportCourse | null {
  if (typeof value !== 'string') return null;
  const match = TRANSPORT_COURSE_TAG_PATTERN.exec(value);
  return parseTransportCourse(match?.[1]);
}

export function buildTransportNotes(
  baseNotes: string | null | undefined,
  attendantStaffId: string | null,
  courseId: TransportCourse | null,
): string | undefined {
  const base = stripTransportMetaTags(baseNotes);
  const normalizedAttendantStaffId = normalizeText(attendantStaffId);
  const tags: string[] = [];
  if (normalizedAttendantStaffId) {
    tags.push(`[transport_attendant:${normalizedAttendantStaffId}]`);
  }
  if (courseId) {
    tags.push(`[transport_course:${courseId}]`);
  }
  if (tags.length === 0) return base ?? '';
  const joinedTags = tags.join(' ');
  return base ? `${base} ${joinedTags}` : joinedTags;
}

function toDateKeyInTransportTz(value: string): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TRANSPORT_TZ }).format(date);
}

function toWeekdayFromDateKey(dateKey: string): number {
  return new Date(`${dateKey}${TRANSPORT_NOON_SUFFIX}`).getUTCDay();
}

export function isSameDraftDate(
  row: Pick<TransportAssignmentScheduleRow, 'start'>,
  targetDate: string,
): boolean {
  const start = normalizeText(row.start);
  if (!start) return false;
  return toDateKeyInTransportTz(start) === targetDate;
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

export function toNullableLookupId(value: string | number | undefined): string | undefined {
  if (typeof value === 'number') return String(value);
  return normalizeText(value) ?? undefined;
}

export function toScheduleCategory(value: string | undefined): UpdateScheduleEventInput['category'] {
  if (value === 'User' || value === 'Staff' || value === 'Org' || value === 'LivingSupport') {
    return value;
  }
  return 'User';
}

export function toScheduleStatus(value: string | undefined): UpdateScheduleEventInput['status'] | undefined {
  if (value === 'Planned' || value === 'Postponed' || value === 'Cancelled') {
    return value;
  }
  return undefined;
}

export function toScheduleVisibility(value: string | undefined): UpdateScheduleEventInput['visibility'] | undefined {
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
      courseId: null,
      courseLabel: null,
      driverStaffId: null,
      driverName: null,
      attendantStaffId: null,
      attendantName: null,
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
    if (!isSameDraftDate(row, input.date)) continue;
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
    const courseId = existing?.courseId ?? extractTransportCourseId(row.notes);
    const courseLabel = getTransportCourseLabel(courseId);
    const driverStaffId = existing?.driverStaffId ?? normalizeText(row.assignedStaffId);
    const driverName = resolveStaffName(
      driverStaffId ?? null,
      existing?.driverName ?? normalizeText(row.assignedStaffName),
      staffNameIndex,
    );
    const attendantStaffId = existing?.attendantStaffId ?? extractTransportAttendantStaffId(row.notes);
    const attendantName = resolveStaffName(
      attendantStaffId,
      existing?.attendantName ?? null,
      staffNameIndex,
    );
    const scheduleRefs = [...(existing?.scheduleRefs ?? []), toScheduleRef(row)];

    assignments.set(userId, {
      userId,
      userName,
      vehicleId: vehicleId ?? null,
      courseId,
      courseLabel,
      driverStaffId: driverStaffId ?? null,
      driverName,
      attendantStaffId: attendantStaffId ?? null,
      attendantName,
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
      courseId: null,
      courseLabel: null,
      driverStaffId: null,
      driverName: null,
      attendantStaffId: null,
      attendantName: null,
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
        courseId: state.courseId,
        courseLabel: state.courseLabel,
        driverStaffId: state.driverStaffId,
        driverName: state.driverName,
        attendantStaffId: state.attendantStaffId,
        attendantName: state.attendantName,
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
    if (!currentVehicle.courseId && state.courseId) {
      currentVehicle.courseId = state.courseId;
    }
    if (!currentVehicle.courseLabel && state.courseLabel) {
      currentVehicle.courseLabel = state.courseLabel;
    }
    if (!currentVehicle.attendantStaffId && state.attendantStaffId) {
      currentVehicle.attendantStaffId = state.attendantStaffId;
    }
    if (!currentVehicle.attendantName && state.attendantName) {
      currentVehicle.attendantName = state.attendantName;
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

type PreviousWeekdayDefaultsCandidate = CrewAssignment & {
  date: string;
  driverName: string | null;
};

type CoursePreferenceSource = Pick<TransportAssignmentUserSource, 'fixedCourseId' | 'fixedCourseLabel'>;
type CourseHistorySource = Pick<CrewAssignment, 'courseId'>;

export function resolveDefaultTransportCourse(
  user: CoursePreferenceSource | null | undefined,
  history: CourseHistorySource | null | undefined,
): TransportCourse | null {
  const fixed = parseTransportCourse(user?.fixedCourseId ?? user?.fixedCourseLabel);
  if (fixed) return fixed;
  return parseTransportCourse(history?.courseId) ?? null;
}

export function applyPreviousWeekdayDefaults(
  input: ApplyPreviousWeekdayDefaultsInput,
): TransportAssignmentDraft {
  const targetWeekday = toWeekdayFromDateKey(input.draft.date);
  const candidateByUserId = new Map<string, PreviousWeekdayDefaultsCandidate>();
  const fixedCourseByUserId = new Map<string, TransportCourse>();
  for (const source of input.users ?? []) {
    const userId = normalizeText(source.userId);
    if (!userId) continue;
    const fixedCourseId = parseTransportCourse(source.fixedCourseId ?? source.fixedCourseLabel);
    if (!fixedCourseId) continue;
    fixedCourseByUserId.set(userId, fixedCourseId);
  }

  for (const row of input.schedules) {
    const start = normalizeText(row.start);
    if (!start) continue;
    const rowDate = toDateKeyInTransportTz(start);
    if (!rowDate || rowDate >= input.draft.date) continue;
    if (toWeekdayFromDateKey(rowDate) !== targetWeekday) continue;

    const rawRow = row as unknown as Record<string, unknown>;
    if (!isTransportScheduleRow(rawRow)) continue;
    if (!inferTransportDirections(rawRow).includes(input.draft.direction)) continue;

    const userId = normalizeText(row.userId);
    if (!userId) continue;

    const candidate: PreviousWeekdayDefaultsCandidate = {
      date: rowDate,
      vehicleId: normalizeText(row.vehicleId),
      courseId: extractTransportCourseId(row.notes),
      driverStaffId: normalizeText(row.assignedStaffId),
      attendantStaffId: extractTransportAttendantStaffId(row.notes),
      driverName: normalizeText(row.assignedStaffName),
    };
    if (!candidate.vehicleId && !candidate.driverStaffId && !candidate.attendantStaffId && !candidate.courseId) continue;

    const currentCandidate = candidateByUserId.get(userId);
    if (!currentCandidate || candidate.date > currentCandidate.date) {
      candidateByUserId.set(userId, candidate);
    }
  }

  if (candidateByUserId.size === 0 && fixedCourseByUserId.size === 0) {
    return input.draft;
  }

  let nextDraft = input.draft;

  for (const user of nextDraft.users) {
    const candidate = candidateByUserId.get(user.userId);
    const fixedCourseId = fixedCourseByUserId.get(user.userId) ?? null;
    if (!candidate && !fixedCourseId) continue;

    const currentVehicle = nextDraft.vehicles.find((vehicle) => vehicle.riderUserIds.includes(user.userId));
    const currentVehicleId = currentVehicle?.vehicleId ?? null;
    const fallbackVehicleId = candidate?.vehicleId ?? null;
    const targetVehicleId = currentVehicleId ?? fallbackVehicleId;
    const isCurrentVehicleDifferentFromHistory =
      Boolean(currentVehicleId && fallbackVehicleId && currentVehicleId !== fallbackVehicleId);

    if (!currentVehicleId && fallbackVehicleId) {
      nextDraft = assignUserToVehicle(nextDraft, user.userId, fallbackVehicleId);
    }

    if (!targetVehicleId) continue;

    let vehicleChanged = false;
    const nextVehicles = nextDraft.vehicles.map((vehicle) => {
      if (vehicle.vehicleId !== targetVehicleId) return vehicle;

      const currentDriverStaffId = normalizeText(vehicle.driverStaffId);
      const currentAttendantStaffId = normalizeText(vehicle.attendantStaffId);
      const currentCourseId = vehicle.courseId;
      const historyDriverStaffId = isCurrentVehicleDifferentFromHistory ? null : (candidate?.driverStaffId ?? null);
      const historyAttendantStaffId = isCurrentVehicleDifferentFromHistory ? null : (candidate?.attendantStaffId ?? null);
      const historyCourseId = isCurrentVehicleDifferentFromHistory ? null : (candidate?.courseId ?? null);
      const nextDriverStaffId = currentDriverStaffId ?? historyDriverStaffId;
      const nextAttendantStaffId = currentAttendantStaffId ?? historyAttendantStaffId;
      const nextCourseDefault = resolveDefaultTransportCourse(
        { fixedCourseId },
        { courseId: historyCourseId },
      );
      const nextCourseId = currentCourseId ?? nextCourseDefault;
      const nextDriverName = normalizeText(vehicle.driverName) ?? (isCurrentVehicleDifferentFromHistory ? null : (candidate?.driverName ?? null));
      const currentDriverName = normalizeText(vehicle.driverName);

      if (
        nextDriverStaffId === currentDriverStaffId
        && nextAttendantStaffId === currentAttendantStaffId
        && nextCourseId === currentCourseId
        && nextDriverName === currentDriverName
      ) {
        return vehicle;
      }

      vehicleChanged = true;
      return {
        ...vehicle,
        courseId: nextCourseId ?? null,
        courseLabel: getTransportCourseLabel(nextCourseId),
        driverStaffId: nextDriverStaffId ?? null,
        driverName: nextDriverName ?? null,
        attendantStaffId: nextAttendantStaffId ?? null,
      };
    });

    if (vehicleChanged) {
      nextDraft = {
        ...nextDraft,
        vehicles: nextVehicles,
      };
    }
  }

  return nextDraft;
}

export function buildSchedulePatchPayloads(input: BuildSchedulePatchPayloadsInput): UpdateScheduleEventInput[] {
  const assignmentByUserId = new Map<string, CrewAssignment>();

  for (const vehicle of input.draft.vehicles) {
    for (const userId of vehicle.riderUserIds) {
      assignmentByUserId.set(userId, {
        vehicleId: vehicle.vehicleId,
        courseId: vehicle.courseId,
        driverStaffId: vehicle.driverStaffId,
        attendantStaffId: vehicle.attendantStaffId,
      });
    }
  }

  for (const userId of input.draft.unassignedUserIds) {
    assignmentByUserId.set(userId, {
      vehicleId: null,
      courseId: null,
      driverStaffId: null,
      attendantStaffId: null,
    });
  }

  const payloads: UpdateScheduleEventInput[] = [];

  for (const row of input.schedules) {
    if (!isSameDraftDate(row, input.draft.date)) continue;
    const rawRow = row as unknown as Record<string, unknown>;
    if (!isTransportScheduleRow(rawRow)) continue;
    if (!inferTransportDirections(rawRow).includes(input.draft.direction)) continue;

    const userId = normalizeText(row.userId);
    if (!userId) continue;

    const nextAssignment = assignmentByUserId.get(userId);
    if (!nextAssignment) continue;

    // 現在の状態を抽出（空文字に正規化して比較を容易にする）
    const currentVehicleId = normalizeText(row.vehicleId) ?? '';
    const currentCourseId = extractTransportCourseId(row.notes) ?? '';
    const currentDriverStaffId = normalizeText(row.assignedStaffId) ?? '';
    const currentAttendantStaffId = extractTransportAttendantStaffId(row.notes) ?? '';

    // 変更検知（ADT的アプローチへの架け橋）
    const detectChange = <T>(curr: T | '', next: T | null): AssignmentChange<T> => {
      const n = next ?? '';
      if (curr === n) return { kind: 'no-change' };
      if (n === '') return { kind: 'unassign' };
      return { kind: 'assign', value: next as T };
    };

    const vehicleChange = detectChange(currentVehicleId, nextAssignment.vehicleId);
    const courseChange = detectChange(currentCourseId, nextAssignment.courseId);
    const driverChange = detectChange(currentDriverStaffId, nextAssignment.driverStaffId);
    const attendantChange = detectChange(currentAttendantStaffId, nextAssignment.attendantStaffId);

    // 1つでも変更があれば PATCH 対象
    if (
      vehicleChange.kind === 'no-change' &&
      courseChange.kind === 'no-change' &&
      driverChange.kind === 'no-change' &&
      attendantChange.kind === 'no-change'
    ) {
      continue;
    }

    // 契約値（Repositoryが期待する undefined/''/value）に変換
    const patchVehicleId = toAssignmentContractValue(vehicleChange);
    const patchDriverStaffId = toAssignmentContractValue(driverChange);
    // 注釈（Notes）は、変更がある場合のみ再構築
    const nextNotes = buildTransportNotes(
      row.notes, 
      nextAssignment.attendantStaffId, 
      nextAssignment.courseId
    );

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
      assignedStaffId: patchDriverStaffId as string | undefined,
      locationName: normalizeText(row.locationName) ?? undefined,
      notes: nextNotes,
      vehicleId: patchVehicleId as string | undefined,
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
