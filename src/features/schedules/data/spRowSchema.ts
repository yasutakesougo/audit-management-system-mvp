import { z } from 'zod';

import type { SchedItem, ScheduleStatus } from './port';
import { normalizeServiceType } from '../serviceTypeMetadata';
import { trackSpEvent } from '@/lib/telemetry/spTelemetry';

// SharePoint raw category values (legacy / optional).
export const SpScheduleCategoryRaw = z.string();
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
    // Candidates for core fields
    Title: z.unknown().optional().nullable(),
    Subject: z.unknown().optional().nullable(),

    Start: z.unknown().optional().nullable(),
    EventDate: z.unknown().optional().nullable(),
    StartDate: z.unknown().optional().nullable(),
    date: z.unknown().optional().nullable(),

    End: z.unknown().optional().nullable(),
    EndDate: z.unknown().optional().nullable(),

    UserCode: z.unknown().optional().nullable(),
    TargetUserCode: z.unknown().optional().nullable(),
    ExternalId: z.unknown().optional().nullable(),

    TargetUserId: z.unknown().optional().nullable(),
    TargetUser: z.unknown().optional().nullable(),
    UserLookupId: z.unknown().optional().nullable(),

    AssignedStaff: z.unknown().optional().nullable(),
    AssignedStaffId: z.unknown().optional().nullable(),
    StaffID: z.unknown().optional().nullable(),
    StaffId: z.unknown().optional().nullable(),

    ServiceType: z.unknown().optional().nullable(),
    cr014_serviceType: z.unknown().optional().nullable(),
    Category: z.unknown().optional().nullable(),

    LocationName: z.unknown().optional().nullable(),
    Location: z.unknown().optional().nullable(),
    Place: z.unknown().optional().nullable(),

    Notes: z.unknown().optional().nullable(),
    Note: z.unknown().optional().nullable(),
    Description: z.unknown().optional().nullable(),
    Comment: z.unknown().optional().nullable(),

    AcceptedOn: z.unknown().optional().nullable(),
    ApprovalDate: z.unknown().optional().nullable(),
    AcceptedBy: z.unknown().optional().nullable(),
    Approver: z.unknown().optional().nullable(),
    AcceptedNote: z.unknown().optional().nullable(),
    ApprovalNote: z.unknown().optional().nullable(),

    Vehicle: z.unknown().optional().nullable(),
    VehicleId: z.unknown().optional().nullable(),
    CarId: z.unknown().optional().nullable(),

    Status: z.unknown().optional().nullable(),
    ScheduleStatus: z.unknown().optional().nullable(),
    State: z.unknown().optional().nullable(),

    StatusReason: z.unknown().optional().nullable(),
    CancelReason: z.unknown().optional().nullable(),
    Reason: z.unknown().optional().nullable(),

    OwnerUserId: z.unknown().optional().nullable(),
    OwnerId: z.unknown().optional().nullable(),
    AuthorId: z.unknown().optional().nullable(),

    Visibility: z.unknown().optional().nullable(),
    AccessLevel: z.unknown().optional().nullable(),

    Created: z.unknown().optional().nullable(),
    AuthoringDate: z.unknown().optional().nullable(),
    Modified: z.unknown().optional().nullable(),
    EditorDate: z.unknown().optional().nullable(),

    EntryHash: z.string().optional().nullable(),

    __metadata: z
      .object({
        id: z.string().optional(),
      })
      .optional()
      .nullable(),
  })
  .passthrough();

export type SpScheduleRow = z.infer<typeof SpScheduleRowSchema>;


export const parseSpScheduleRows = (input: unknown): SpScheduleRow[] => {
  if (!input) return [];

  // Handle OData D results wrapper
  let rawItems: unknown[] = [];
  if (Array.isArray(input)) {
    rawItems = input;
  } else if (input && typeof input === 'object') {
    const o = input as Record<string, unknown>;
    if (Array.isArray(o.value)) {
      rawItems = o.value;
    } else if (o.d && typeof o.d === 'object' && Array.isArray((o.d as Record<string, unknown>).results)) {
      rawItems = (o.d as Record<string, unknown>).results as unknown[];
    }
  }

  const rows: SpScheduleRow[] = [];
  for (const item of rawItems) {
    const result = SpScheduleRowSchema.safeParse(item);
    if (result.success) {
      rows.push(result.data);
    } else {
      // Absorb partial row corruption - log but don't fail the whole array
      const rowId = (item as Record<string, unknown>)?.Id;
      console.warn('[schedules] Invalid row skipped:', {
        id: rowId,
        issues: result.error.issues.slice(0, 3)
      });
      // Telemetry: report skipped row
      trackSpEvent('sp:row_skipped', {
        key: rowId ? 'invalid_schema' : 'unknown',
        details: { 
          rowId: String(rowId ?? 'unknown'),
          context: 'parseSpScheduleRows'
        }
      });
    }
  }
  return rows;
};

/** Facility/Other/Org -> Org, User stays User, Staff stays Staff. */
export function mapSpCategoryToDomain(raw?: SpScheduleCategoryRaw | null): 'Org' | 'User' | 'Staff' {
  if (!raw) {
    return 'Org';
  }
  const normalized = String(raw).trim().toLowerCase();

  // Primary: English
  if (normalized === 'user' || normalized === 'client' || normalized === 'resident') return 'User';
  if (normalized === 'staff' || normalized === 'employee' || normalized === 'member') return 'Staff';
  if (normalized === 'org' || normalized === 'facility' || normalized === 'other' || normalized === 'office') return 'Org';

  // Fallback: Japanese (Common in localized tenants)
  if (normalized === '利用者' || normalized === '利用' || normalized === '入居者') return 'User';
  if (normalized === '職員' || normalized === 'スタッフ' || normalized === '担当') return 'Staff';
  if (normalized === '施設' || normalized === 'その他' || normalized === '法人' || normalized === '事業所' || normalized === '事業') return 'Org';

  console.warn(`[schedules] Unknown category value "${raw}" — defaulting to Org`);
  return 'Org';
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
  // Single SharePoint Lookup Object (e.g. { Id: 101, Value: '...' })
  if (value && typeof value === 'object' && 'Id' in (value as { Id?: unknown })) {
    const id = coerceIdString((value as { Id?: unknown }).Id);
    return id ? [id] : [];
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

const pickFirstValue = (row: SpScheduleRow, candidates: string[]): unknown => {
  for (const key of candidates) {
    const val = (row as Record<string, unknown>)[key];
    if (val !== undefined && val !== null) return val;
  }
  return undefined;
}

export const normalizeStatusFromSp = (raw: unknown): ScheduleStatus => {
  if (raw == null) return 'Planned';
  const value = String(raw).trim();
  if (!value) return 'Planned';

  const normalized = value.toLowerCase();

  // English
  if (normalized === 'planned' || normalized === 'scheduled' || normalized === 'open') return 'Planned';
  if (normalized === 'postponed' || normalized === 'onhold') return 'Postponed';
  if (normalized === 'cancelled' || normalized === 'canceled' || normalized === 'none' || normalized === 'void') return 'Cancelled';

  // Japanese
  if (value === '予定どおり' || value === '予定' || value === '実施') return 'Planned';
  if (value === '延期' || value === '保留' || value === '調整中') return 'Postponed';
  if (value === '中止' || value === 'キャンセル' || value === 'なし' || value === '実施せず') return 'Cancelled';

  return 'Planned';
};

/**
 * Raw SP row → Domain SchedItem
 * Returns null if required datetime fields are missing.
 */
export function mapSpRowToSchedule(row: SpScheduleRow): SchedItem | null {
  try {
    const start = coerceIso(pickFirstValue(row, ['Start', 'EventDate', 'StartDate', 'date']));
    const end = coerceIso(pickFirstValue(row, ['End', 'EndDate', 'date']));
    if (!start || !end) return null;

    const idRaw = row.Id;
    const id = coerceIdString(idRaw) ?? `${start}-${end}`;

    // Phase 2-0: extract etag from __metadata.id or generate fallback
    const etagValue = row.__metadata?.id ? `"${row.__metadata.id}"` : `"sp-${id}"`;

    const titleCandidate = coerceString(pickFirstValue(row, ['Title', 'Subject']));
    const title = titleCandidate ?? '予定';

    const userCodeRaw = coerceString(pickFirstValue(row, ['UserCode', 'TargetUserCode', 'ExternalId']));
    const normalizedUserId = normalizeUserId(userCodeRaw);

    const userLookupIdValue = pickFirstValue(row, ['TargetUserId', 'TargetUser', 'UserLookupId', 'PersonId']);
    const userLookupIds = coerceLookupIds(userLookupIdValue);

    const assignedStaffId = coerceIdString(pickFirstValue(row, ['AssignedStaffId', 'AssignedStaff', 'StaffID', 'StaffId']));
    const vehicleId = coerceIdString(pickFirstValue(row, ['VehicleId', 'Vehicle', 'CarId']));

    // Category inference
    const rawCategory = pickFirstValue(row, ['Category', 'cr014_category', 'PersonType']);
    const category = rawCategory
      ? mapSpCategoryToDomain(rawCategory as SpScheduleCategoryRaw)
      : (normalizedUserId ? 'User' : (assignedStaffId ? 'Staff' : 'Org'));

    const rawServiceType = coerceString(pickFirstValue(row, ['ServiceType', 'cr014_serviceType', 'Category']));
    const serviceTypeKey = normalizeServiceType(rawServiceType);

    const item: SchedItem = {
      id,
      title,
      start,
      end,
      category,
      allDay: false,
      userId: normalizedUserId || (userLookupIds.length ? normalizeUserId(userLookupIds[0]) : undefined),
      serviceType: serviceTypeKey === 'unset' ? undefined : serviceTypeKey,
      locationName: coerceString(pickFirstValue(row, ['LocationName', 'Location', 'Place'])),
      notes: coerceString(pickFirstValue(row, ['Notes', 'Note', 'Description', 'Comment'])),
      acceptedOn: coerceIso(pickFirstValue(row, ['AcceptedOn', 'ApprovalDate'])),
      acceptedBy: coerceString(pickFirstValue(row, ['AcceptedBy', 'Approver'])),
      acceptedNote: coerceString(pickFirstValue(row, ['AcceptedNote', 'ApprovalNote'])) ?? null,
      userName: undefined,
      userLookupId: userLookupIds[0],
      assignedStaffId: assignedStaffId ?? undefined,
      vehicleId: vehicleId ?? undefined,
      status: normalizeStatusFromSp(pickFirstValue(row, ['Status', 'ScheduleStatus', 'State'])),
      statusReason: coerceString(pickFirstValue(row, ['StatusReason', 'CancelReason', 'Reason'])) ?? null,
      entryHash: row.EntryHash ?? undefined,
      createdAt: coerceIso(pickFirstValue(row, ['Created', 'AuthoringDate'])),
      updatedAt: coerceIso(pickFirstValue(row, ['Modified', 'EditorDate'])),
      ownerUserId: coerceString(pickFirstValue(row, ['OwnerUserId', 'OwnerId', 'AuthorId'])),
      visibility: coerceString(pickFirstValue(row, ['Visibility', 'AccessLevel'])) as SchedItem['visibility'],
      etag: etagValue,
    } satisfies SchedItem;

    return item;
  } catch (err) {
    // Absorb mapper error per item - log but don't fail the whole request
    console.error('[mapSpRowToSchedule] 🔴 MAPPER_FAILED_SKIPPING_ITEM', {
      id: row?.Id,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
