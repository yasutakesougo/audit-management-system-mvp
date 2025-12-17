import { createSpClient, ensureConfig } from '@/lib/spClient';
import type { CreateScheduleEventInput, SchedItem, ScheduleServiceType, ScheduleStatus, SchedulesPort } from './port';
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

const resolveCategoryFields = (
  input: CreateScheduleEventInput,
): {
  normalizedUserId: string | null;
  assignedStaffId: string | null;
  personName: string | null;
  normalizedTargetUserId: number | null;
  userLookupId: string | number | null;
} => {
  const normalizedUserId = input.userId ? normalizeUserId(input.userId) : null;
  const assignedStaffId = trimText(input.assignedStaffId) ?? null;
  const personName = trimText((input as { userName?: string }).userName) ?? null;
  const normalizedTargetUserId = normalizeLookupId(input.userLookupId);
  const userLookupId = input.userLookupId ?? null;

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

  return { normalizedUserId, assignedStaffId, personName, normalizedTargetUserId, userLookupId };
};

const appendSeconds = (value: string): string => {
  if (!value.includes('T')) {
    return `${value}T00:00:00`;
  }
  return value.length === 16 ? `${value}:00` : value;
};

const normalizeLookupId = (value: string | number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const ensureTimeZone = (value: string): string => {
  // Treat naive local timestamps as UTC to avoid date shifting when toISOString() is applied.
  const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(value);
  return hasZone ? value : `${value}Z`;
};

const toIsoString = (value: string): string => {
  const normalized = ensureTimeZone(value);
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid datetime value: ${value}`);
  }
  return date.toISOString();
};

const jpServiceLabel = (serviceType?: ScheduleServiceType | null): string => {
  switch (serviceType) {
    case 'absence':
      return '欠席';
    case 'late':
      return '遅刻';
    case 'earlyLeave':
      return '早退';
    default:
      return 'その他';
  }
};

const buildUserTitle = (startLocal: string, userName: string, serviceType: ScheduleServiceType): string => {
  const date = startLocal.slice(0, 10);
  const label = jpServiceLabel(serviceType);
  return `${date} ${userName}（${label}）`;
};

const resolveTitle = (input: CreateScheduleEventInput): string => {
  const rawTitle = trimText(input.title);
  const userName = trimText((input as { userName?: string }).userName);

  if (input.category === 'User' && userName) {
    return buildUserTitle(input.startLocal, userName, input.serviceType);
  }

  return rawTitle || DEFAULT_TITLE;
};

type SharePointPayload = {
  body: Record<string, unknown>;
  title: string;
  startIso: string;
  endIso: string;
};

export const toSharePointPayload = (input: CreateScheduleEventInput): SharePointPayload => {
  const { normalizedUserId, assignedStaffId, personName, normalizedTargetUserId } = resolveCategoryFields(input);
  const title = resolveTitle(input);
  const startIso = toIsoString(appendSeconds(input.startLocal));
  const endIso = toIsoString(appendSeconds(input.endLocal));
  const serviceType = trimText(input.serviceType);
  const locationName = trimText(input.locationName);
  const notes = trimText(input.notes);
  const acceptedOn = trimText(input.acceptedOn);
  const acceptedBy = trimText(input.acceptedBy);
  const acceptedNote = trimText(input.acceptedNote);
  const body: Record<string, unknown> = {
    [SCHEDULES_FIELDS.title]: title,
    [SCHEDULES_FIELDS.start]: startIso,
    [SCHEDULES_FIELDS.end]: endIso,
    // SharePoint choice/text column. We start with a fixed value known to exist.
    [SCHEDULES_FIELDS.status]: 'Scheduled',
  };

  if (serviceType) {
    body[SCHEDULES_FIELDS.serviceType] = serviceType;
  }
  if (input.category === 'User') {
    body[SCHEDULES_FIELDS.personId] = normalizedUserId ?? null;
    body[SCHEDULES_FIELDS.personName] = personName ?? null;
    body[SCHEDULES_FIELDS.targetUserId] = normalizedTargetUserId ?? null;
    body[SCHEDULES_FIELDS.assignedStaff] = null;
  }
  if (locationName) {
    body[SCHEDULES_FIELDS.locationName] = locationName;
  }
  if (notes) {
    body[SCHEDULES_FIELDS.notes] = notes;
  }
  if (acceptedOn) {
    body[SCHEDULES_FIELDS.acceptedOn] = acceptedOn;
  }
  if (acceptedBy) {
    body[SCHEDULES_FIELDS.acceptedBy] = acceptedBy;
  }
  if (input.acceptedNote !== undefined) {
    body[SCHEDULES_FIELDS.acceptedNote] = acceptedNote ?? null;
  }
  if (input.category === 'Staff') {
    body[SCHEDULES_FIELDS.assignedStaff] = assignedStaffId ?? null;
    body[SCHEDULES_FIELDS.personId] = null;
    body[SCHEDULES_FIELDS.personName] = null;
    body[SCHEDULES_FIELDS.targetUserId] = null;
  }
  if (input.category === 'Org') {
    body[SCHEDULES_FIELDS.personId] = null;
    body[SCHEDULES_FIELDS.personName] = null;
    body[SCHEDULES_FIELDS.targetUserId] = null;
  }

  return {
    body,
    title,
    startIso,
    endIso,
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
  acceptedOn?: string;
  acceptedBy?: string;
  acceptedNote?: string | null;
};

const buildSchedItem = (args: BuildSchedItemArgs): SchedItem => ({
  id: args.id,
  title: args.title,
  start: args.start,
  end: args.end,
  userId: args.userId,
  userLookupId: args.userLookupId,
  category: args.category,
  serviceType: args.serviceType as SchedItem['serviceType'],
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
  acceptedOn: args.acceptedOn,
  acceptedBy: args.acceptedBy,
  acceptedNote: args.acceptedNote ?? null,
});

export const makeMockScheduleCreator = (): SchedulesPort['create'] => async (input) => {
  const { normalizedUserId, assignedStaffId, personName, userLookupId } = resolveCategoryFields(input);
  const title = resolveTitle(input);
  const start = toIsoString(appendSeconds(input.startLocal));
  const end = toIsoString(appendSeconds(input.endLocal));
  const now = new Date().toISOString();
  return buildSchedItem({
    id: `mock-${Date.now()}`,
    title,
    start,
    end,
    userId: input.category === 'User' ? normalizedUserId ?? undefined : undefined,
    userLookupId: input.category === 'User'
      ? userLookupId != null
        ? String(userLookupId)
        : undefined
      : undefined,
    personName: input.category === 'User' ? personName ?? undefined : undefined,
    category: input.category,
    serviceType: input.serviceType,
    locationName: trimText(input.locationName),
    notes: trimText(input.notes),
    assignedStaffId: input.category === 'Staff' ? assignedStaffId ?? undefined : undefined,
    vehicleId: trimText(input.vehicleId),
    status: input.status ?? 'Planned',
    statusReason: null,
    entryHash: undefined,
    createdAt: now,
    updatedAt: now,
    acceptedOn: trimText(input.acceptedOn),
    acceptedBy: trimText(input.acceptedBy),
    acceptedNote: input.acceptedNote ?? null,
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
    const serviceType = trimText(input.serviceType);
    const locationNameValue = trimText(input.locationName);
    const notesValue = trimText(input.notes);
    const acceptedOnValue = trimText(input.acceptedOn);
    const acceptedByValue = trimText(input.acceptedBy);
    const { normalizedUserId, assignedStaffId, personName, userLookupId } = resolveCategoryFields(input);
    const acceptedNoteValue = input.acceptedNote ?? null;

    return buildSchedItem({
      id,
      title: typeof persistedTitleRaw === 'string' && persistedTitleRaw.trim() ? persistedTitleRaw : payload.title,
      start: typeof persistedStartRaw === 'string' && persistedStartRaw ? persistedStartRaw : payload.startIso,
      end: typeof persistedEndRaw === 'string' && persistedEndRaw ? persistedEndRaw : payload.endIso,
      category: input.category,
      serviceType,
      userId: input.category === 'User' ? normalizedUserId ?? undefined : undefined,
      userLookupId: input.category === 'User'
        ? userLookupId != null
          ? String(userLookupId)
          : undefined
        : undefined,
      personName: input.category === 'User' ? personName ?? undefined : undefined,
      locationName: locationNameValue ?? undefined,
      notes: notesValue ?? undefined,
      assignedStaffId: input.category === 'Staff' ? assignedStaffId ?? undefined : undefined,
      status: input.status ?? 'Planned',
      statusReason: null,
      createdAt: created?.Created,
      updatedAt: created?.Modified,
      acceptedOn: acceptedOnValue,
      acceptedBy: acceptedByValue,
      acceptedNote: acceptedNoteValue,
    });
  };
};
