import { createHash } from '@/utils/createHash';
import type { CreateScheduleEventInput, DateRange, SchedItem, SchedulesPort, UpdateScheduleEventInput } from './port';

const formatISO = (date: Date): string => date.toISOString();
const addHours = (date: Date, hours: number): Date => new Date(date.getTime() + hours * 60 * 60 * 1000);

const base = new Date();
base.setSeconds(0, 0);

let demoItems: SchedItem[] = [
  {
    id: 'demo-visit-morning',
    title: '訪問介護（午前）',
    start: formatISO(base),
    end: formatISO(addHours(base, 2)),
    status: 'Planned',
    statusReason: null,
  },
  {
    id: 'demo-meeting',
    title: 'ケース会議',
    start: formatISO(addHours(base, 3)),
    end: formatISO(addHours(base, 4)),
    status: 'Planned',
    statusReason: null,
  },
  {
    id: 'demo-visit-afternoon',
    title: '訪問介護（午後）',
    start: formatISO(addHours(base, 6)),
    end: formatISO(addHours(base, 8)),
    status: 'Planned',
    statusReason: null,
  },
];

const normalizeStatusReason = (value?: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const withinRange = ({ start, end }: SchedItem, range: DateRange) => {
  const fromTs = new Date(range.from).getTime();
  const toTs = new Date(range.to).getTime();
  const startTs = new Date(start).getTime();
  const endTs = new Date(end).getTime();
  if ([fromTs, toTs, startTs, endTs].some(Number.isNaN)) return true;
  return startTs < toTs && endTs > fromTs;
};

const toIsoString = (value: string): string => {
  const normalized = value.includes('T') ? value : `${value}T00:00:00`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const normalizeLocal = (value: string): string => (value.length === 16 ? `${value}:00` : value);

const normalizeOptionalLocal = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  return toIsoString(normalizeLocal(value));
};

const normalizeOptionalText = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const normalizeNote = (value?: string | null): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const resolveTitle = (input: CreateScheduleEventInput): string =>
  (input.title ?? '').trim() || '新規予定';

export const demoSchedulesPort: SchedulesPort = {
  async list(range) {
    return demoItems.filter((item) => withinRange(item, range));
  },
  async create(input) {
    const title = resolveTitle(input);
    const start = toIsoString(normalizeLocal(input.startLocal));
    const end = toIsoString(normalizeLocal(input.endLocal));
    const status = input.status ?? 'Planned';
    const statusReason = normalizeStatusReason(input.statusReason);
    const acceptedOn = normalizeOptionalLocal(input.acceptedOn);
    const acceptedBy = normalizeOptionalText(input.acceptedBy);
    const acceptedNote = normalizeNote(input.acceptedNote);
    const entryHash = createHash({
      title,
      userId: input.userId ?? null,
      start,
      end,
      serviceType: input.serviceType,
      assignedStaffId: input.assignedStaffId ?? null,
      vehicleId: input.vehicleId ?? null,
      status,
      statusReason,
    });
    const now = new Date().toISOString();
    const created: SchedItem = {
      id: `demo-${Date.now()}`,
      title,
      start,
      end,
      userId: input.userId,
      userLookupId: input.userLookupId,
      personName: input.userName,
      serviceType: input.serviceType,
      locationName: input.locationName,
      notes: input.notes,
      assignedStaffId: input.assignedStaffId,
      vehicleId: input.vehicleId,
      status,
      statusReason,
      acceptedOn,
      acceptedBy,
      acceptedNote,
      entryHash,
      createdAt: now,
      updatedAt: now,
    } satisfies SchedItem;

    demoItems = [...demoItems, created];
    return created;
  },
  async update(input: UpdateScheduleEventInput) {
    const index = demoItems.findIndex((item) => item.id === input.id);
    if (index === -1) {
      throw new Error(`Schedule not found: ${input.id}`);
    }

    const start = toIsoString(normalizeLocal(input.startLocal));
    const end = toIsoString(normalizeLocal(input.endLocal));
    const title = resolveTitle(input);
    const updatedAt = new Date().toISOString();
    const acceptedOn = normalizeOptionalLocal(input.acceptedOn) ?? demoItems[index].acceptedOn;
    const acceptedBy = normalizeOptionalText(input.acceptedBy) ?? demoItems[index].acceptedBy;
    const acceptedNote =
      input.acceptedNote !== undefined ? normalizeNote(input.acceptedNote) : demoItems[index].acceptedNote ?? null;

    const next: SchedItem = {
      ...demoItems[index],
      id: input.id,
      title,
      start,
      end,
      category: input.category,
      userId: input.userId ?? demoItems[index].userId,
      userLookupId: input.userLookupId ?? demoItems[index].userLookupId,
      personName: input.userName ?? demoItems[index].personName,
      serviceType: input.serviceType,
      locationName: input.locationName ?? demoItems[index].locationName,
      notes: input.notes ?? demoItems[index].notes,
      assignedStaffId: input.assignedStaffId ?? demoItems[index].assignedStaffId,
      vehicleId: input.vehicleId ?? demoItems[index].vehicleId,
      status: input.status ?? demoItems[index].status,
      statusReason:
        input.statusReason !== undefined
          ? normalizeStatusReason(input.statusReason)
          : demoItems[index].statusReason ?? null,
      updatedAt,
      acceptedOn,
      acceptedBy,
      acceptedNote,
    };

    demoItems[index] = next;
    return next;
  },
};
