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
import type { useSP } from '@/lib/spClient';
import {
  buildTransportLogTitle,
  TRANSPORT_LOG_FIELDS,
  TRANSPORT_LOG_SELECT_FIELDS,
} from '@/sharepoint/fields/transportFields';
import {
  ATTENDANCE_DAILY_FIELDS,
  ATTENDANCE_DAILY_LIST_TITLE,
} from '@/sharepoint/fields/attendanceFields';
import { LIST_CONFIG, ListKeys } from '@/sharepoint/fields/listRegistry';
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

function mapSpRowToLogEntry(row: SpTransportLogRow): TransportLogEntry {
  return {
    userId: String(row[TRANSPORT_LOG_FIELDS.userCode] ?? ''),
    direction: (row[TRANSPORT_LOG_FIELDS.direction] ?? 'to') as TransportDirection,
    status: (row[TRANSPORT_LOG_FIELDS.status] ?? 'pending') as TransportLegStatus,
    actualTime: row[TRANSPORT_LOG_FIELDS.actualTime]
      ? String(row[TRANSPORT_LOG_FIELDS.actualTime])
      : undefined,
    driverName: row[TRANSPORT_LOG_FIELDS.driverName]
      ? String(row[TRANSPORT_LOG_FIELDS.driverName])
      : undefined,
    notes: row[TRANSPORT_LOG_FIELDS.notes]
      ? String(row[TRANSPORT_LOG_FIELDS.notes])
      : undefined,
  };
}

function buildSaveBody(input: SaveTransportLogInput): Record<string, unknown> {
  const title = buildTransportLogTitle(input.userCode, input.recordDate, input.direction);

  const body: Record<string, unknown> = {
    [TRANSPORT_LOG_FIELDS.title]: title,
    [TRANSPORT_LOG_FIELDS.userCode]: input.userCode,
    [TRANSPORT_LOG_FIELDS.recordDate]: input.recordDate,
    [TRANSPORT_LOG_FIELDS.direction]: input.direction,
    [TRANSPORT_LOG_FIELDS.status]: input.status,
  };

  // Optional fields — only set if provided
  if (input.method !== undefined) body[TRANSPORT_LOG_FIELDS.method] = input.method;
  if (input.scheduledTime !== undefined) body[TRANSPORT_LOG_FIELDS.scheduledTime] = input.scheduledTime;
  if (input.actualTime !== undefined) body[TRANSPORT_LOG_FIELDS.actualTime] = input.actualTime;
  if (input.driverName !== undefined) body[TRANSPORT_LOG_FIELDS.driverName] = input.driverName;
  if (input.notes !== undefined) body[TRANSPORT_LOG_FIELDS.notes] = input.notes;
  if (input.updatedBy !== undefined) body[TRANSPORT_LOG_FIELDS.updatedBy] = input.updatedBy;

  // Always set updatedAt to current ISO timestamp
  body[TRANSPORT_LOG_FIELDS.updatedAt] = new Date().toISOString();

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

  try {
    const rows = await client.listItems<SpTransportLogRow>(listTitle, {
      select: [...TRANSPORT_LOG_SELECT_FIELDS],
      filter: `${TRANSPORT_LOG_FIELDS.recordDate} eq '${recordDate}'`,
      top: 200, // max expected per day (users × 2 directions)
    });

    return rows.map(mapSpRowToLogEntry);
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
  const body = buildSaveBody(input);

  try {
    // Step 1: Check if item already exists
    const existing = await client.listItems<SpTransportLogRow>(listTitle, {
      select: ['Id'],
      filter: `${TRANSPORT_LOG_FIELDS.title} eq '${titleKey}'`,
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

  // Build partial patch payload (only transport fields for this direction)
  const patch: Record<string, unknown> = {};
  if (input.direction === 'to') {
    patch[ATTENDANCE_DAILY_FIELDS.transportTo] = isShuttle;
    if (input.method) patch[ATTENDANCE_DAILY_FIELDS.transportToMethod] = input.method;
  } else {
    patch[ATTENDANCE_DAILY_FIELDS.transportFrom] = isShuttle;
    if (input.method) patch[ATTENDANCE_DAILY_FIELDS.transportFromMethod] = input.method;
  }

  try {
    // Look up existing daily record by Key
    const existing = await client.listItems<{ Id: number }>(listTitle, {
      select: ['Id'],
      filter: `${ATTENDANCE_DAILY_FIELDS.key} eq '${dailyKey}'`,
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
