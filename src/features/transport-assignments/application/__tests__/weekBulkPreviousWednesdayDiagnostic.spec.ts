import { describe, expect, it } from 'vitest';
import { mapSpRowToSchedule, type SpScheduleRow } from '@/features/schedules/data/spRowSchema';
import type { SchedItem } from '@/features/schedules/domain/ScheduleRepository';
import { buildWeekDateOptions, getWeekStartDate } from '@/pages/transport-assignment/TransportAssignmentPage.logic';
import { buildSchedulePatchPayloadsViaDomain } from '@/features/transport-assignments/adapters/assignmentAdapter';
import { orchestrateWeekBulkApply } from '@/features/transport-assignments/application/transportAssignmentApplication';
import {
  applyPreviousWeekdayDefaults,
  buildTransportAssignmentDraft,
  isSameDraftDate,
  type TransportAssignmentDraft,
  type TransportAssignmentScheduleRow,
} from '@/features/transport-assignments/domain/transportAssignmentDraft';
import {
  DEFAULT_TRANSPORT_VEHICLE_IDS,
  inferTransportDirections,
} from '@/features/today/transport/transportAssignments';

/**
 * Diagnostic for CI run 42964123100.
 * Rows are the week-bulk E2E stub items. The Note on 93003 is the spec value,
 * which contains the attendant tag plus the course tag already present in that fixture.
 */
const TARGET_DATE = '2026-03-25';
const PREVIOUS_DATE = '2026-03-18';
const PREVIOUS_ITEM_ID = '93003';

const WEEK_BULK_SCHEDULE_ROWS = [
  {
    Id: 93_001,
    Title: '送迎（往路）',
    EventDate: `${TARGET_DATE}T08:30:00+09:00`,
    EndDate: `${TARGET_DATE}T09:00:00+09:00`,
    Start: `${TARGET_DATE}T08:30:00+09:00`,
    End: `${TARGET_DATE}T09:00:00+09:00`,
    Status: 'Planned',
    ServiceType: 'transport',
    Category: 'User',
    cr014_category: 'User',
    UserCode: 'U002',
    cr014_personType: 'User',
    cr014_personId: 'U002',
    cr014_personName: '鈴木 美子',
    AssignedStaff: null,
    AssignedStaffId: null,
    Vehicle: null,
    VehicleId: null,
    Note: null,
    '@odata.etag': '"e2e-transport-week-bulk-apply-1"',
  },
  {
    Id: 93_002,
    Title: '送迎（往路）',
    EventDate: `${TARGET_DATE}T08:40:00+09:00`,
    EndDate: `${TARGET_DATE}T09:10:00+09:00`,
    Start: `${TARGET_DATE}T08:40:00+09:00`,
    End: `${TARGET_DATE}T09:10:00+09:00`,
    Status: 'Planned',
    ServiceType: 'transport',
    Category: 'User',
    cr014_category: 'User',
    UserCode: 'U001',
    cr014_personType: 'User',
    cr014_personId: 'U001',
    cr014_personName: '田中 太郎',
    AssignedStaff: 'STF003',
    AssignedStaffId: 'STF003',
    Vehicle: '車両2',
    VehicleId: '車両2',
    Note: null,
    '@odata.etag': '"e2e-transport-week-bulk-apply-2"',
  },
  {
    Id: 93_003,
    Title: '送迎（往路）',
    EventDate: `${PREVIOUS_DATE}T08:30:00+09:00`,
    EndDate: `${PREVIOUS_DATE}T09:00:00+09:00`,
    Start: `${PREVIOUS_DATE}T08:30:00+09:00`,
    End: `${PREVIOUS_DATE}T09:00:00+09:00`,
    Status: 'Planned',
    ServiceType: 'transport',
    Category: 'User',
    cr014_category: 'User',
    UserCode: 'U002',
    cr014_personType: 'User',
    cr014_personId: 'U002',
    cr014_personName: '鈴木 美子',
    AssignedStaff: 'STF001',
    AssignedStaffId: 'STF001',
    Vehicle: '車両1',
    VehicleId: '車両1',
    Note: '玄関前待機 [transport_attendant:STF002] [transport_course:isogo]',
    '@odata.etag': '"e2e-transport-week-bulk-apply-3"',
  },
  {
    Id: 93_004,
    Title: '送迎（往路）',
    EventDate: `${PREVIOUS_DATE}T08:40:00+09:00`,
    EndDate: `${PREVIOUS_DATE}T09:10:00+09:00`,
    Start: `${PREVIOUS_DATE}T08:40:00+09:00`,
    End: `${PREVIOUS_DATE}T09:10:00+09:00`,
    Status: 'Planned',
    ServiceType: 'transport',
    Category: 'User',
    cr014_category: 'User',
    UserCode: 'U001',
    cr014_personType: 'User',
    cr014_personId: 'U001',
    cr014_personName: '田中 太郎',
    AssignedStaff: 'STF001',
    AssignedStaffId: 'STF001',
    Vehicle: '車両4',
    VehicleId: '車両4',
    Note: null,
    '@odata.etag': '"e2e-transport-week-bulk-apply-4"',
  },
] as unknown as SpScheduleRow[];

function jstDateKey(start: string): string | null {
  const parsed = new Date(start);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(parsed);
}

function vehicleIdFor(draft: TransportAssignmentDraft, userId: string): string | null {
  return draft.vehicles.find((vehicle) => vehicle.riderUserIds.includes(userId))?.vehicleId ?? null;
}

function mapScheduleRows(rows: readonly SpScheduleRow[]): TransportAssignmentScheduleRow[] {
  return rows
    .map((row) => mapSpRowToSchedule(row))
    .filter((row): row is SchedItem => row !== null) as unknown as TransportAssignmentScheduleRow[];
}

function orchestrateForTarget(scheduleRows: readonly TransportAssignmentScheduleRow[]) {
  const targetRowsByJst = scheduleRows.filter((row) => row.start && jstDateKey(row.start) === TARGET_DATE);
  const baseDraft = buildTransportAssignmentDraft({
    date: TARGET_DATE,
    direction: 'to',
    schedules: targetRowsByJst,
    users: [],
    staff: [],
    fixedVehicleIds: DEFAULT_TRANSPORT_VEHICLE_IDS,
  });
  const weekdayDefaultDraft = applyPreviousWeekdayDefaults({
    draft: baseDraft,
    schedules: scheduleRows,
    users: [],
  });
  return orchestrateWeekBulkApply({
    targetDate: TARGET_DATE,
    direction: 'to',
    weekdayDefaultDraft,
    scheduleRows: [...scheduleRows],
    userSources: [],
    staffSources: [],
    weekDateOptions: buildWeekDateOptions(getWeekStartDate(TARGET_DATE)),
  });
}

describe('week-bulk previous Wednesday diagnostic', () => {
  it('traces the synthetic fixture through mapper, previous-weekday defaults, and payloads', () => {
    const scheduleRows = mapScheduleRows(WEEK_BULK_SCHEDULE_ROWS);
    const mapped = scheduleRows;
    const previous = scheduleRows.find((row) => row.id === PREVIOUS_ITEM_ID);

    expect(mapped).toHaveLength(WEEK_BULK_SCHEDULE_ROWS.length);
    expect(previous).toMatchObject({
      id: PREVIOUS_ITEM_ID,
      userId: 'U002',
      vehicleId: '車両1',
      assignedStaffId: 'STF001',
    });
    expect(previous?.start && jstDateKey(previous.start)).toBe(PREVIOUS_DATE);
    expect(previous?.notes).toContain('[transport_attendant:STF002]');
    expect(inferTransportDirections(previous as unknown as Record<string, unknown>)).toEqual(['to']);

    const targetRowsByJst = scheduleRows.filter((row) => row.start && jstDateKey(row.start) === TARGET_DATE);
    const baseDraft = buildTransportAssignmentDraft({
      date: TARGET_DATE,
      direction: 'to',
      schedules: targetRowsByJst,
      users: [],
      staff: [],
      fixedVehicleIds: DEFAULT_TRANSPORT_VEHICLE_IDS,
    });
    const appliedOnce = applyPreviousWeekdayDefaults({
      draft: baseDraft,
      schedules: scheduleRows,
      users: [],
    });
    const appliedTwice = applyPreviousWeekdayDefaults({
      draft: appliedOnce,
      schedules: scheduleRows,
      users: [],
    });

    expect(vehicleIdFor(appliedOnce, 'U002')).toBe('車両1');
    expect(vehicleIdFor(appliedTwice, 'U002')).toBe('車両1');
    expect(vehicleIdFor(appliedTwice, 'U001')).toBe('車両2');

    const targetRowsByPrefix = scheduleRows.filter((row) => row.start?.startsWith(TARGET_DATE));
    const payloadsByJst = buildSchedulePatchPayloadsViaDomain(appliedTwice, targetRowsByJst);
    const payloadsByPrefix = buildSchedulePatchPayloadsViaDomain(appliedTwice, targetRowsByPrefix);

    expect(payloadsByJst).toHaveLength(1);
    expect(payloadsByJst[0]).toMatchObject({
      id: '93001',
      userId: 'U002',
      vehicleId: '車両1',
      assignedStaffId: 'STF001',
    });
    // GO-B evidence: mapper emits UTC instants, so a JST date prefix matches nothing.
    // This is not the success condition for week-bulk.
    expect(previous?.start).toBe('2026-03-17T23:30:00.000Z');
    expect(targetRowsByJst.map((row) => row.start)).toEqual([
      '2026-03-24T23:30:00.000Z',
      '2026-03-24T23:40:00.000Z',
    ]);
    expect(targetRowsByPrefix).toEqual([]);
    expect(payloadsByPrefix).toHaveLength(0);

    const result = orchestrateForTarget(scheduleRows);
    const wednesday = result.summary.find((item) => item.date === TARGET_DATE);

    expect(wednesday?.count).toBe(1);
    expect(result.payloads).toHaveLength(1);
    expect(result.payloads[0]).toMatchObject({
      id: '93001',
      userId: 'U002',
      vehicleId: '車両1',
      assignedStaffId: 'STF001',
    });
    expect(vehicleIdFor(result.nextDraft, 'U002')).toBe('車両1');
    expect(vehicleIdFor(result.nextDraft, 'U001')).toBe('車両2');
  });

  it('keeps a JST 2026-03-24 row out of the Wednesday payloads', () => {
    const scheduleRows = mapScheduleRows([
      ...WEEK_BULK_SCHEDULE_ROWS,
      {
        Id: 93_170,
        Title: '送迎（往路）',
        EventDate: '2026-03-17T08:30:00+09:00',
        EndDate: '2026-03-17T09:00:00+09:00',
        Start: '2026-03-17T08:30:00+09:00',
        End: '2026-03-17T09:00:00+09:00',
        Status: 'Planned',
        ServiceType: 'transport',
        Category: 'User',
        UserCode: 'U002',
        AssignedStaffId: 'STF009',
        VehicleId: '車両9',
        Note: null,
        '@odata.etag': '"e2e-diag-0317"',
      },
      {
        Id: 93_240,
        Title: '送迎（往路）',
        EventDate: '2026-03-24T08:30:00+09:00',
        EndDate: '2026-03-24T09:00:00+09:00',
        Start: '2026-03-24T08:30:00+09:00',
        End: '2026-03-24T09:00:00+09:00',
        Status: 'Planned',
        ServiceType: 'transport',
        Category: 'User',
        UserCode: 'U002',
        AssignedStaffId: null,
        VehicleId: null,
        Note: null,
        '@odata.etag': '"e2e-diag-0324"',
      },
    ] as unknown as SpScheduleRow[]);
    const result = orchestrateForTarget(scheduleRows);
    const tuesday = result.summary.find((item) => item.date === '2026-03-24');
    const wednesday = result.summary.find((item) => item.date === TARGET_DATE);

    const wednesdayPayloadIds = result.payloads
      .filter((payload) => payload.startLocal && jstDateKey(payload.startLocal) === TARGET_DATE)
      .map((payload) => payload.id);
    const previousDayPayloadIds = result.payloads
      .filter((payload) => payload.startLocal && jstDateKey(payload.startLocal) === '2026-03-24')
      .map((payload) => payload.id);

    expect(jstDateKey('2026-03-23T23:30:00.000Z')).toBe('2026-03-24');
    expect(tuesday?.count).toBe(1);
    expect(previousDayPayloadIds).toEqual(['93240']);
    expect(wednesday?.count).toBe(1);
    expect(wednesdayPayloadIds).toEqual(['93001']);
  });

  it('excludes an unparseable start without throwing', () => {
    const scheduleRows = mapScheduleRows([
      ...WEEK_BULK_SCHEDULE_ROWS,
      {
        Id: 93_999,
        Title: '送迎（往路）',
        EventDate: 'not-a-date',
        EndDate: `${TARGET_DATE}T09:00:00+09:00`,
        Start: 'not-a-date',
        End: `${TARGET_DATE}T09:00:00+09:00`,
        Status: 'Planned',
        ServiceType: 'transport',
        Category: 'User',
        UserCode: 'U002',
        AssignedStaffId: null,
        VehicleId: null,
        Note: null,
        '@odata.etag': '"e2e-diag-invalid"',
      },
    ] as unknown as SpScheduleRow[]);
    const invalid = scheduleRows.find((row) => row.id === '93999');

    expect(invalid?.start).toBe('not-a-date');
    expect(isSameDraftDate(invalid ?? { start: 'not-a-date' }, TARGET_DATE)).toBe(false);

    const result = orchestrateForTarget(scheduleRows);
    const wednesday = result.summary.find((item) => item.date === TARGET_DATE);

    expect(wednesday?.count).toBe(1);
    expect(result.payloads.map((payload) => payload.id)).not.toContain('93999');
    expect(result.payloads.map((payload) => payload.id)).toEqual(['93001']);
  });
});
