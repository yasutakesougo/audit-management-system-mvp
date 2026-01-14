import { z } from 'zod';

import type { SchedItem, ScheduleStatus } from './port';
import { normalizeServiceType } from '../serviceTypeMetadata';

/**
 * SharePoint raw category values (legacy / optional).
 * Some lists may still store a category choice in cr014_category / Category.
 * Older tenants renamed choices to "Org" / "Staff", so we accept those too.
 */
export const SpScheduleCategoryRaw = z.enum(['User', 'Facility', 'Other', 'Org', 'Staff']);
export type SpScheduleCategoryRaw = z.infer<typeof SpScheduleCategoryRaw>;

/**
 * SharePoint raw row schema.
 * - Current Schedules list uses: Title, Start, End, UserCode, AssignedStaff, etc.
 * - Legacy schedule list may use: EventDate, EndDate, cr014_category.
 *
 * We accept both to keep the adapter resilient.
 */
export const SpScheduleRowSchema = z
  .object({
    Id: z.union([z.number(), z.string()]),
    Title: z.string().optional().nullable(),
    Start: z.string().optional().nullable(),
    End: z.string().optional().nullable(),
    EventDate: z.string().optional().nullable(),
    EndDate: z.string().optional().nullable(),

    UserCode: z.string().optional().nullable(),
    TargetUserId: z.unknown().optional().nullable(),

    AssignedStaff: z.union([z.number(), z.string()]).optional().nullable(),
    ServiceType: z.string().optional().nullable(),
    cr014_serviceType: z.string().optional().nullable(),
    LocationName: z.string().optional().nullable(),
    Notes: z.string().optional().nullable(),
    AcceptedOn: z.string().optional().nullable(),
    AcceptedBy: z.string().optional().nullable(),
    AcceptedNote: z.string().optional().nullable(),
    Vehicle: z.union([z.number(), z.string()]).optional().nullable(),
    Status: z.string().optional().nullable(),
    StatusReason: z.string().optional().nullable(),
    EntryHash: z.string().optional().nullable(),

    Created: z.string().optional().nullable(),
    Modified: z.string().optional().nullable(),

    // optional legacy category columns
    cr014_category: SpScheduleCategoryRaw.optional().nullable(),
    Category: SpScheduleCategoryRaw.optional().nullable(),
  })
  .passthrough();

export type SpScheduleRow = z.infer<typeof SpScheduleRowSchema>;

export const parseSpScheduleRows = (input: unknown): SpScheduleRow[] =>
  SpScheduleRowSchema.array().parse(input);

/** Facility/Other → Org/Staff, User stays User */
export function mapSpCategoryToDomain(raw?: SpScheduleCategoryRaw | null): 'Org' | 'User' | 'Staff' | undefined {
  if (!raw) return undefined;
  switch (raw) {
    case 'User':
      return 'User';
    case 'Facility':
    case 'Org':
      return 'Org';
    case 'Other':
    case 'Staff':
      return 'Staff';
    default:
      return undefined;
  }
}

const coerceIso = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toISOString();
};

const coerceString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

const coerceIdString = (value: unknown): string | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  return undefined;
};

const coerceLookupIds = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (entry && typeof entry === 'object' && 'Id' in (entry as { Id?: unknown })) {
          return coerceIdString((entry as { Id?: unknown }).Id);
        }
        return coerceIdString(entry);
      })
      .filter((entry): entry is string => Boolean(entry));
  }
  if (value && typeof value === 'object' && 'results' in (value as { results?: unknown })) {
    const results = (value as { results?: unknown }).results;
    if (Array.isArray(results)) {
      return coerceLookupIds(results);
    }
  }
  const single = coerceIdString(value);
  return single ? [single] : [];
};

/** Normalize U-001 → U001, trim + uppercase, keep alphanumerics only */
export const normalizeUserId = (raw?: string | null): string | undefined => {
  if (!raw) return undefined;
  const cleaned = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return cleaned || undefined;
};

// Prefer EventDate/EndDate so we keep the original local time (with offset)
// when both legacy and modern columns are present. Start/End are fallback.
const pickStart = (row: SpScheduleRow): string | undefined =>
  coerceIso(row.EventDate ?? row.Start);

const pickEnd = (row: SpScheduleRow): string | undefined =>
  coerceIso(row.EndDate ?? row.End);

const pickUserCode = (row: SpScheduleRow): string | undefined =>
  coerceString(row.UserCode);

const inferCategory = (row: SpScheduleRow): 'Org' | 'User' | 'Staff' => {
  const rawCategory = (row.cr014_category ?? row.Category) as SpScheduleCategoryRaw | undefined;
  const mapped = mapSpCategoryToDomain(rawCategory);
  if (mapped) return mapped;

  const userCode = pickUserCode(row);
  if (userCode) return 'User';

  const staffId = coerceIdString(row.AssignedStaff);
  if (staffId) return 'Staff';

  return 'Org';
};

const normalizeStatusFromSp = (raw: unknown): ScheduleStatus => {
  const value = typeof raw === 'string' ? raw.trim() : raw == null ? '' : String(raw).trim();
  if (!value) {
    return 'Planned';
  }

  const normalized = value.toLowerCase();

  if (value === 'Planned' || normalized === 'planned' || value === '予定どおり' || value === '予定') {
    return 'Planned';
  }
  if (value === 'Scheduled' || normalized === 'scheduled') {
    return 'Planned';
  }
  if (value === 'Postponed' || normalized === 'postponed' || value === '延期') {
    return 'Postponed';
  }
  if (
    value === 'Cancelled' ||
    normalized === 'cancelled' ||
    normalized === 'canceled' ||
    value === '中止' ||
    value === 'キャンセル'
  ) {
    return 'Cancelled';
  }

  // eslint-disable-next-line no-console
  console.warn('[schedules] Unknown SharePoint Status value:', value);
  return 'Planned';
};

/**
 * Raw SP row → Domain SchedItem
 * Returns null if required datetime fields are missing.
 */
export function mapSpRowToSchedule(row: SpScheduleRow): SchedItem | null {
  const start = pickStart(row);
  const end = pickEnd(row);
  if (!start || !end) return null;

  const idRaw = row.Id;
  const id =
    typeof idRaw === 'number'
      ? String(idRaw)
      : typeof idRaw === 'string' && idRaw.trim()
        ? idRaw.trim()
        : `${start}-${end}`;

  const titleField = row.Title;
  const providedTitle = typeof titleField === 'string' && titleField.trim() ? titleField.trim() : undefined;
  const title = providedTitle ?? '予定';
  const userCodeCandidates = [pickUserCode(row)];
  let normalizedUserId: string | undefined;
  for (const candidate of userCodeCandidates) {
    const normalized = normalizeUserId(candidate);
    if (normalized) {
      normalizedUserId = normalized;
      break;
    }
  }
  const userLookupIds = coerceLookupIds(row.TargetUserId);
  if (!normalizedUserId && userLookupIds.length) {
    normalizedUserId = normalizeUserId(userLookupIds[0]);
  }
  const assignedStaffId = coerceIdString(row.AssignedStaff);
  const vehicleId = coerceIdString(row.Vehicle);

  const category = inferCategory(row);

  const rawServiceType = coerceString(row.ServiceType) ?? coerceString((row as { cr014_serviceType?: unknown }).cr014_serviceType);
  const serviceTypeKey = normalizeServiceType(rawServiceType);
  const item: SchedItem = {
    id,
    title,
    start,
    end,
    category,
    allDay: false,
    userId: normalizedUserId,
    serviceType: serviceTypeKey === 'unset' ? undefined : serviceTypeKey,
    locationName: coerceString(row.LocationName),
    notes: coerceString(row.Notes),
    acceptedOn: coerceIso(row.AcceptedOn),
    acceptedBy: coerceString(row.AcceptedBy),
    acceptedNote: coerceString(row.AcceptedNote) ?? null,
    personName: undefined,
    userLookupId: userLookupIds[0],
    assignedStaffId: assignedStaffId ?? undefined,
    vehicleId: vehicleId ?? undefined,
    status: normalizeStatusFromSp(row.Status),
    statusReason: coerceString(row.StatusReason) ?? null,
    entryHash: coerceString(row.EntryHash),
    createdAt: coerceIso(row.Created),
    updatedAt: coerceIso(row.Modified),
  } satisfies SchedItem;

  // Keep the original SharePoint title when provided; fall back to person name if missing.

  return item;
}
