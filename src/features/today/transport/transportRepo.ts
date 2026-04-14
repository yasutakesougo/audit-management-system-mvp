/**
 * Transport Status — SharePoint Repository
 *
 * Phase 3 of Issue #635.
 *
 * Responsibilities:
 * 1. Load today's transport logs from Transport_Log list
 * 2. Save/upsert transport status changes (fire-and-forget from hook)
 * 3. (Phase 3.5) Sync confirmed status to AttendanceDaily
 *
 * Data Flow:
 *   useTransportStatus → transportRepo → SharePoint Transport_Log
 *                                     → SharePoint AttendanceDaily (sync)
 *
 * Write Gate: All mutations go through assertWriteEnabled().
 * Graceful Degradation: List not found (404) → returns empty / no-op.
 */

import { isWriteEnabled } from '@/env';
import type { useSP, UseSP } from '@/lib/spClient';
import {
  buildTransportLogTitle,
  TRANSPORT_LOG_CANDIDATES,
  TRANSPORT_LOG_SELECT_FIELDS,
} from '@/sharepoint/fields/transportFields';
import {
  ATTENDANCE_DAILY_CANDIDATES,
  ATTENDANCE_DAILY_LIST_TITLE,
} from '@/sharepoint/fields/attendanceFields';
import { LIST_CONFIG, ListKeys } from '@/sharepoint/fields/listRegistry';
import { resolveInternalNamesDetailed } from '@/lib/sp/helpers';
import { buildEq } from '@/sharepoint/query/builders';
import { methodImpliesShuttle } from '@/features/attendance/transportMethod';
import type { TransportLogEntry } from './transportStatusLogic';
import type { TransportDirection, TransportLegStatus } from './transportTypes';
import type { TransportMethod } from '@/features/attendance/transportMethod';

// ─── Write Gate ─────────────────────────────────────────────────────────────

class WriteDisabledError extends Error {
  readonly code = 'WRITE_DISABLED' as const;
  constructor(operation: string) {
    super(`Write operation "${operation}" is disabled. Set VITE_WRITE_ENABLED=1 to enable.`);
    this.name = 'WriteDisabledError';
  }
}

function assertWriteEnabled(operation: string): void {
  if (!isWriteEnabled) {
    throw new WriteDisabledError(operation);
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

/** Raw SP row for Transport_Log */
type SpTransportLogRow = Record<string, unknown>;

/** Input for saving a transport log entry */
export type SaveTransportLogInput = {
  userCode: string;
  recordDate: string;     // yyyy-MM-dd
  direction: TransportDirection;
  status: TransportLegStatus;
  method?: TransportMethod;
  scheduledTime?: string; // HH:mm
  actualTime?: string;    // HH:mm
  driverName?: string;
  notes?: string;
  updatedBy?: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

const LOG = '[transportRepo]';

function getListTitle(): string {
  return LIST_CONFIG[ListKeys.TransportLog].title;
}

// ─── Field Resolution ───────────────────────────────────────────────────────

let transportFieldsCache: Record<string, string | undefined> | null = null;
let attendanceFieldsCache: Record<string, string | undefined> | null = null;

async function resolveTransportFields(client: ReturnType<typeof useSP>): Promise<Record<string, string | undefined> | null> {
  if (transportFieldsCache) return transportFieldsCache;
  const listTitle = getListTitle();
  try {
    const available = await (client as unknown as UseSP).getListFieldInternalNames(listTitle);
    const { resolved } = resolveInternalNamesDetailed(available, TRANSPORT_LOG_CANDIDATES as unknown as Record<string, string[]>);
    transportFieldsCache = resolved as Record<string, string | undefined>;
    return transportFieldsCache;
  } catch (err) {
    console.warn(`${LOG} Failed to resolve transport fields, using fallback.`, err);
    return null;
  }
}

async function resolveAttendanceFields(client: ReturnType<typeof useSP>): Promise<Record<string, string | undefined> | null> {
  if (attendanceFieldsCache) return attendanceFieldsCache;
  const listTitle = ATTENDANCE_DAILY_LIST_TITLE;
  try {
    const available = await (client as unknown as UseSP).getListFieldInternalNames(listTitle);
    const { resolved } = resolveInternalNamesDetailed(available, ATTENDANCE_DAILY_CANDIDATES as unknown as Record<string, string[]>);
    attendanceFieldsCache = resolved as Record<string, string | undefined>;
    return attendanceFieldsCache;
  } catch (err) {
    console.warn(`${LOG} Failed to resolve attendance fields, using fallback.`, err);
    return null;
  }
}

/** Helper to provide a safe field name with fallback and warning on missing mapping */
function asField(physical: string | undefined, fallback: string): string {
  if (!physical) {
    // Keep internal logging minimal to avoid console noise, but useful for debugging
    return fallback;
  }
  return physical;
}

function mapSpRowToLogEntry(row: SpTransportLogRow, fields: Record<string, string | undefined>): TransportLogEntry {
  const get = (key: string, fallback: string) => {
    const fieldName = asField(fields[key], fallback);
    return String(row[fieldName] ?? '');
  };
  
  return {
    userId: get('userCode', 'UserCode'),
    direction: (get('direction', 'Direction') || 'to') as TransportDirection,
    status: (get('status', 'Status') || 'pending') as TransportLegStatus,
    actualTime: row[asField(fields.actualTime, 'ActualTime')] ? String(row[asField(fields.actualTime, 'ActualTime')]) : undefined,
    driverName: row[asField(fields.driverName, 'DriverName')] ? String(row[asField(fields.driverName, 'DriverName')]) : undefined,
    notes: row[asField(fields.notes, 'Notes')] ? String(row[asField(fields.notes, 'Notes')]) : undefined,
  };
}

function buildSaveBody(input: SaveTransportLogInput, fields: Record<string, string | undefined>): Record<string, unknown> {
  const title = buildTransportLogTitle(input.userCode, input.recordDate, input.direction);

  const body: Record<string, unknown> = {
    Title: title, // Title is essential, usually fixed
  };

  const mapping: Record<string, unknown> = {
    userCode: input.userCode,
    recordDate: input.recordDate,
    direction: input.direction,
    status: input.status,
    method: input.method,
    scheduledTime: input.scheduledTime,
    actualTime: input.actualTime,
    driverName: input.driverName,
    notes: input.notes,
    updatedBy: input.updatedBy,
    updatedAt: new Date().toISOString(),
  };

  for (const [key, value] of Object.entries(mapping)) {
    if (value !== undefined) {
      const physical = asField(fields[key], key.charAt(0).toUpperCase() + key.slice(1));
      body[physical] = value;
    }
  }

  return body;
}

// ─── Read ───────────────────────────────────────────────────────────────────

/**
 * Load all transport logs for a given date.
 *
 * Graceful degradation: returns empty array if list doesn't exist (404).
 */
export async function loadTransportLogs(
  client: ReturnType<typeof useSP>,
  recordDate: string, // yyyy-MM-dd
): Promise<TransportLogEntry[]> {
  const listTitle = getListTitle();
  const fields = await resolveTransportFields(client);

  try {
    const rows = await client.listItems<SpTransportLogRow>(listTitle, {
      select: fields 
        ? ['Id', 'Created', ...Object.values(fields).filter((v): v is string => !!v)] 
        : [...TRANSPORT_LOG_SELECT_FIELDS],
      filter: buildEq(asField(fields?.recordDate, 'RecordDate'), recordDate),
      top: 200, // max expected per day (users × 2 directions)
    });

    return rows.map(r => mapSpRowToLogEntry(r, fields || {}));
  } catch (err: unknown) {
    // Graceful degradation: list not found (404) or field not found (400) → empty
    const status = (err as { status?: number })?.status;
    const message = err instanceof Error ? err.message : String(err);

    if (status === 404 || message.includes('does not exist')) {
      console.warn(`${LOG} Transport_Log list not found, returning empty. Create the list to enable persistence.`);
      return [];
    }
    if (status === 400 || message.includes('は存在しません')) {
      console.warn(`${LOG} Transport_Log has missing columns (400), returning empty. Provision required columns to enable persistence.`);
      return [];
    }

    console.error(`${LOG} Failed to load transport logs:`, err);
    throw err;
  }
}

// ─── Write (Upsert) ─────────────────────────────────────────────────────────

/**
 * Save a transport log entry (upsert by Title composite key).
 *
 * Strategy:
 * 1. Build Title key: {UserCode}_{Date}_{Direction}
 * 2. Query existing item by Title
 * 3. If exists → PATCH (update)
 * 4. If not → POST (create)
 *
 * Graceful degradation: if list doesn't exist, logs warning and returns.
 */
export async function saveTransportLog(
  client: ReturnType<typeof useSP>,
  input: SaveTransportLogInput,
): Promise<void> {
  assertWriteEnabled('saveTransportLog');

  const listTitle = getListTitle();
  const titleKey = buildTransportLogTitle(input.userCode, input.recordDate, input.direction);
  const fields = await resolveTransportFields(client);
  const body = buildSaveBody(input, fields || {});

  try {
    // Step 1: Check if item already exists
    const existing = await client.listItems<SpTransportLogRow>(listTitle, {
      select: ['Id'],
      filter: buildEq(asField(fields?.title, 'Title'), titleKey),
      top: 1,
    });

    if (existing.length > 0) {
      // Step 2a: Update existing item
      const existingId = Number(existing[0].Id);
      if (existingId && Number.isFinite(existingId)) {
        await client.updateItem(listTitle, existingId, body);
        console.debug(`${LOG} Updated transport log: ${titleKey} (id=${existingId})`);
      }
    } else {
      // Step 2b: Create new item
      await client.addListItemByTitle(listTitle, body);
      console.debug(`${LOG} Created transport log: ${titleKey}`);
    }
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    const message = err instanceof Error ? err.message : String(err);

    if (status === 404 || message.includes('does not exist')) {
      console.warn(`${LOG} Transport_Log list not found, skipping save. Create the list to enable persistence.`);
      return;
    }
    if (status === 400 || message.includes('は存在しません')) {
      console.warn(`${LOG} Transport_Log has missing columns (400), skipping save. Provision required columns to enable persistence.`);
      return;
    }

    console.error(`${LOG} Failed to save transport log (${titleKey}):`, err);
    throw err;
  }
}

// ─── Sync to AttendanceDaily ────────────────────────────────────────────────

/**
 * Sync transport confirmation to AttendanceDaily.
 *
 * When a leg reaches 'arrived' status, we patch the corresponding
 * AttendanceDaily record with:
 *   - TransportTo/TransportFrom = true/false (derived from method)
 *   - TransportToMethod/TransportFromMethod = the method enum value
 *
 * Design:
 * - Key format: {UserCode}_{yyyy-MM-dd} (matches AttendanceDaily.Key)
 * - Only syncs when status === 'arrived'
 * - Graceful degradation: list/record not found → no-op
 * - Write gate: requires VITE_WRITE_ENABLED=1
 *
 * Phase 3.5 of Issue #635.
 */
export type SyncToAttendanceDailyInput = {
  userCode: string;
  recordDate: string;     // yyyy-MM-dd
  direction: TransportDirection;
  status: TransportLegStatus;
  method?: TransportMethod;
};

export async function syncToAttendanceDaily(
  client: ReturnType<typeof useSP>,
  input: SyncToAttendanceDailyInput,
): Promise<void> {
  // Only sync when arrived
  if (input.status !== 'arrived') return;

  assertWriteEnabled('syncToAttendanceDaily');

  const listTitle = ATTENDANCE_DAILY_LIST_TITLE;
  const dailyKey = `${input.userCode}_${input.recordDate}`;
  const isShuttle = input.method ? methodImpliesShuttle(input.method) : false;

  const fields = await resolveAttendanceFields(client);
  if (!fields) {
    console.warn(`${LOG} Skipping sync to AttendanceDaily because fields could not be resolved.`);
    return;
  }

  // Build partial patch payload (only transport fields for this direction)
  const patch: Record<string, unknown> = {};
  if (input.direction === 'to') {
    if (fields.transportTo) patch[fields.transportTo] = isShuttle;
    if (input.method && fields.transportToMethod) patch[fields.transportToMethod] = input.method;
  } else {
    if (fields.transportFrom) patch[fields.transportFrom] = isShuttle;
    if (input.method && fields.transportFromMethod) patch[fields.transportFromMethod] = input.method;
  }

  try {
    // Look up existing daily record by Key
    const existing = await client.listItems<{ Id: number }>(listTitle, {
      select: ['Id'],
      filter: buildEq(asField(fields.key, 'Title'), dailyKey),
      top: 1,
    });

    if (!existing || existing.length === 0) {
      // No AttendanceDaily record yet — skip sync
      // This is normal during early morning before check-in
      console.debug(`${LOG} AttendanceDaily not found for key=${dailyKey}, skipping sync`);
      return;
    }

    const recordId = Number(existing[0].Id);
    if (!Number.isFinite(recordId)) return;

    await client.updateItem(listTitle, recordId, patch);
    console.debug(`${LOG} Synced transport ${input.direction} to AttendanceDaily: key=${dailyKey}`);
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    const message = err instanceof Error ? err.message : String(err);

    if (status === 404 || message.includes('does not exist')) {
      console.warn(`${LOG} AttendanceDaily list not found, skipping sync.`);
      return;
    }

    // Log but don't throw — this is a secondary sync, should not break the main flow
    console.error(`${LOG} Failed to sync to AttendanceDaily (key=${dailyKey}):`, err);
  }
}
