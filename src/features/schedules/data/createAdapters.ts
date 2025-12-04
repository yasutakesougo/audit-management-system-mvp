import { createSpClient, ensureConfig } from '@/lib/spClient';
import { createHash } from '@/utils/createHash';
import type { CreateScheduleEventInput, SchedItem, ScheduleStatus, SchedulesPort } from './port';
import { SCHEDULES_FIELDS, SCHEDULES_LIST_TITLE } from './spSchema';

const DEFAULT_TITLE = '新規予定';

export const normalizeUserId = (value: string): string => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

const trimText = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const coerceString = (value: unknown): string | undefined => trimText(typeof value === 'string' ? value : undefined);

const coerceLookupIdString = (value: unknown): string | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  }
  if (value && typeof value === 'object') {
    const results = (value as { results?: unknown[] }).results;
    if (Array.isArray(results) && results.length > 0) {
      return coerceLookupIdString(results[0]);
    }
  }
  return undefined;
};

const normalizeStatusReason = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const resolveCategoryFields = (input: CreateScheduleEventInput): {
  normalizedUserId?: string;
  assignedStaffId?: string;
} => {
  const normalizedUserId = input.userId ? normalizeUserId(input.userId) : undefined;
  const assignedStaffId = trimText(input.assignedStaffId);

  if (input.category === 'User') {
    if (!normalizedUserId) {
      throw new Error('利用者予定の作成には利用者IDが必要です');
    }
  }

  if (input.category === 'Staff') {
    if (!assignedStaffId) {
      throw new Error('職員予定の作成には担当職員IDが必要です');
    }
  }

  return { normalizedUserId, assignedStaffId };
};

const appendSeconds = (value: string): string => {
  if (!value.includes('T')) {
    return `${value}T00:00:00`;
  }
  return value.length === 16 ? `${value}:00` : value;
};

const toIsoString = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid datetime value: ${value}`);
  }
  return date.toISOString();
};

const resolveTitle = (input: CreateScheduleEventInput): string =>
  (input.title ?? '').trim() || DEFAULT_TITLE;

type SharePointPayload = {
  body: Record<string, unknown>;
  title: string;
  startIso: string;
  endIso: string;
  status: string;
  statusReason: string | null;
  serviceType: CreateScheduleEventInput['serviceType'];
  normalizedUserId?: string;
  userLookupId?: number;
  userName?: string;
  assignedStaffId?: string;
  locationName?: string;
  notes?: string;
  vehicleId?: string;
  entryHash: string;
};

export const toSharePointPayload = (input: CreateScheduleEventInput): SharePointPayload => {
  const { normalizedUserId, assignedStaffId } = resolveCategoryFields(input);
  const title = resolveTitle(input);
  const startIso = toIsoString(appendSeconds(input.startLocal));
  const endIso = toIsoString(appendSeconds(input.endLocal));
  const status = input.status ?? 'Planned';
  const statusReason = normalizeStatusReason(input.statusReason);
  const locationName = trimText(input.locationName);
  const notes = trimText(input.notes);
  const vehicleId = trimText(input.vehicleId);
  const userLookupId = (() => {
    if (!input.userLookupId) {
      return undefined;
    }
    const numeric = Number(input.userLookupId);
    return Number.isFinite(numeric) ? Number(numeric) : undefined;
  })();
  const userName = trimText(input.userName);
  const entryHash = createHash({
    title,
    userId: normalizedUserId ?? null,
    start: startIso,
    end: endIso,
    serviceType: input.serviceType,
    assignedStaffId: assignedStaffId ?? null,
    vehicleId: vehicleId ?? null,
    status,
    statusReason,
  });
  const body: Record<string, unknown> = {
    [SCHEDULES_FIELDS.title]: title,
    [SCHEDULES_FIELDS.start]: startIso,
    [SCHEDULES_FIELDS.end]: endIso,
    [SCHEDULES_FIELDS.status]: status,
    [SCHEDULES_FIELDS.entryHash]: entryHash,
  };
  body[SCHEDULES_FIELDS.serviceType] = input.serviceType;
  if (normalizedUserId) {
    body[SCHEDULES_FIELDS.personId] = normalizedUserId;
  }
  if (input.category === 'User') {
    body[SCHEDULES_FIELDS.personName] = userName ?? null;
    body[SCHEDULES_FIELDS.targetUserId] = userLookupId ?? null;
  } else {
    body[SCHEDULES_FIELDS.personId] = null;
    body[SCHEDULES_FIELDS.personName] = null;
    body[SCHEDULES_FIELDS.targetUserId] = null;
  }
  if (locationName) {
    body[SCHEDULES_FIELDS.locationName] = locationName;
  }
  if (notes) {
    body[SCHEDULES_FIELDS.notes] = notes;
  }
  if (assignedStaffId) {
    body[SCHEDULES_FIELDS.assignedStaff] = assignedStaffId;
  }
  if (vehicleId) {
    body[SCHEDULES_FIELDS.vehicle] = vehicleId;
  }

  return {
    body,
    title,
    startIso,
    endIso,
    status,
    statusReason,
    serviceType: input.serviceType,
    normalizedUserId,
    userLookupId,
    userName,
    assignedStaffId,
    locationName,
    notes,
    vehicleId,
    entryHash,
  };
};

type BuildSchedItemArgs = {
  id: string;
  title: string;
  start: string;
  end: string;
  userId?: string;
  userLookupId?: string;
  category?: SchedItem['category'];
  serviceType?: string;
  locationName?: string;
  notes?: string;
  assignedStaffId?: string;
  vehicleId?: string;
  status?: string;
  statusReason?: string | null;
  entryHash?: string;
  createdAt?: string;
  updatedAt?: string;
  personName?: string;
};

const buildSchedItem = (args: BuildSchedItemArgs): SchedItem => ({
  id: args.id,
  title: args.title,
  start: args.start,
  end: args.end,
  userId: args.userId,
  userLookupId: args.userLookupId,
  category: args.category,
  serviceType: args.serviceType,
  locationName: args.locationName,
  notes: args.notes,
  personName: args.personName,
  assignedStaffId: args.assignedStaffId,
  vehicleId: args.vehicleId,
  status: args.status as ScheduleStatus | undefined,
  statusReason: args.statusReason ?? null,
  entryHash: args.entryHash,
  createdAt: args.createdAt,
  updatedAt: args.updatedAt,
});

export const makeMockScheduleCreator = (): SchedulesPort['create'] => async (input) => {
  const { normalizedUserId, assignedStaffId } = resolveCategoryFields(input);
  const title = resolveTitle(input);
  const start = toIsoString(appendSeconds(input.startLocal));
  const end = toIsoString(appendSeconds(input.endLocal));
  const status = input.status ?? 'Planned';
  const statusReason = normalizeStatusReason(input.statusReason);
  const locationName = trimText(input.locationName);
  const notes = trimText(input.notes);
  const vehicleId = trimText(input.vehicleId);
  const entryHash = createHash({
    title,
    userId: normalizedUserId ?? null,
    start,
    end,
    serviceType: input.serviceType,
    assignedStaffId: assignedStaffId ?? null,
    vehicleId: vehicleId ?? null,
    status,
  });
  const now = new Date().toISOString();
  return buildSchedItem({
    id: `mock-${Date.now()}`,
    title,
    start,
    end,
    userId: normalizedUserId,
    userLookupId: input.userLookupId,
    personName: input.userName,
    category: input.category,
    serviceType: input.serviceType,
    locationName,
    notes,
    assignedStaffId,
    vehicleId,
    status,
    statusReason,
    entryHash,
    createdAt: now,
    updatedAt: now,
  });
};

type SharePointScheduleRow = {
  Id?: number;
  Created?: string;
  Modified?: string;
  [key: string]: string | number | null | undefined;
};

type SharePointCreatorOptions = {
  acquireToken: () => Promise<string | null>;
};

export const makeSharePointScheduleCreator = ({ acquireToken }: SharePointCreatorOptions): SchedulesPort['create'] => {
  const { baseUrl } = ensureConfig();
  const client = createSpClient(acquireToken, baseUrl);

  return async (input) => {
    const payload = toSharePointPayload(input);
    const created = await client.addListItemByTitle<typeof payload.body, SharePointScheduleRow>(SCHEDULES_LIST_TITLE, payload.body);
    const id = created?.Id ? String(created.Id) : `sp-${Date.now()}`;
    const persistedTitleRaw = created?.[SCHEDULES_FIELDS.title];
    const persistedStartRaw = created?.[SCHEDULES_FIELDS.start];
    const persistedEndRaw = created?.[SCHEDULES_FIELDS.end];
    const persistedStatusRaw = created?.[SCHEDULES_FIELDS.status];
    const persistedNotesRaw = created?.[SCHEDULES_FIELDS.notes];
    const persistedLocationRaw = created?.[SCHEDULES_FIELDS.locationName];
    const persistedServiceTypeRaw = created?.[SCHEDULES_FIELDS.serviceType];
    const persistedPersonIdRaw = created?.[SCHEDULES_FIELDS.personId];
    const persistedPersonNameRaw = created?.[SCHEDULES_FIELDS.personName];
    const persistedTargetUserIdRaw = created?.[SCHEDULES_FIELDS.targetUserId];
    const persistedAssignedRaw = created?.[SCHEDULES_FIELDS.assignedStaff];
    const persistedVehicleRaw = created?.[SCHEDULES_FIELDS.vehicle];
    const persistedEntryHashRaw = created?.[SCHEDULES_FIELDS.entryHash];

    return buildSchedItem({
      id,
      title: typeof persistedTitleRaw === 'string' && persistedTitleRaw.trim() ? persistedTitleRaw : payload.title,
      start: typeof persistedStartRaw === 'string' && persistedStartRaw ? persistedStartRaw : payload.startIso,
      end: typeof persistedEndRaw === 'string' && persistedEndRaw ? persistedEndRaw : payload.endIso,
      userId: coerceString(persistedPersonIdRaw) ?? payload.normalizedUserId,
      userLookupId: (() => {
        const rawString = coerceLookupIdString(persistedTargetUserIdRaw);
        if (rawString) return rawString;
        return payload.userLookupId != null ? String(payload.userLookupId) : undefined;
      })(),
      personName: coerceString(persistedPersonNameRaw) ?? payload.userName,
      category: input.category,
      serviceType: coerceString(persistedServiceTypeRaw) ?? payload.serviceType,
      locationName: coerceString(persistedLocationRaw) ?? payload.locationName,
      notes: coerceString(persistedNotesRaw) ?? payload.notes,
      assignedStaffId: coerceString(persistedAssignedRaw) ?? payload.assignedStaffId,
      vehicleId: coerceString(persistedVehicleRaw) ?? payload.vehicleId,
      status: typeof persistedStatusRaw === 'string' && persistedStatusRaw ? persistedStatusRaw : payload.status,
      statusReason: payload.statusReason,
      entryHash: typeof persistedEntryHashRaw === 'string' && persistedEntryHashRaw ? persistedEntryHashRaw : payload.entryHash,
      createdAt: created?.Created,
      updatedAt: created?.Modified,
    });
  };
};
