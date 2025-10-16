import { SCHEDULES_BASE_FIELDS, SCHEDULES_SELECT_FIELDS, SCHEDULES_STAFF_TEXT_FIELDS } from '@/sharepoint/fields';
import { afterEach, describe, expect, it, vi } from 'vitest';

type EnvMock = {
  readEnv: ReturnType<typeof vi.fn>;
  isDevMode: ReturnType<typeof vi.fn>;
};

const envMock: EnvMock = {
  readEnv: vi.fn(),
  isDevMode: vi.fn(),
};

type SharePointOverride = {
  baseFields?: readonly string[];
  staffFields?: readonly string[];
  selectClause?: string;
};

const loadScheduleFeatures = async (countFlag = '1', dev = true, overrides?: SharePointOverride) => {
  vi.resetModules();
  envMock.readEnv.mockImplementation((key: string, fallback: string) => {
    if (key === 'VITE_FEATURE_SCHEDULE_STAFF_TEXT_COLUMNS') {
      return countFlag;
    }
    return fallback;
  });
  envMock.isDevMode.mockReturnValue(dev);
  if (overrides) {
    const actual = await vi.importActual<typeof import('@/sharepoint/fields')>('@/sharepoint/fields');
    vi.doMock('@/sharepoint/fields', () => ({
      ...actual,
      SCHEDULES_BASE_FIELDS: overrides.baseFields ?? actual.SCHEDULES_BASE_FIELDS,
      SCHEDULES_COMMON_OPTIONAL_FIELDS: actual.SCHEDULES_COMMON_OPTIONAL_FIELDS,
      SCHEDULES_STAFF_TEXT_FIELDS: overrides.staffFields ?? actual.SCHEDULES_STAFF_TEXT_FIELDS,
      SCHEDULES_SELECT_FIELDS: overrides.selectClause ?? actual.SCHEDULES_SELECT_FIELDS,
    }));
  }
  vi.doMock('@/lib/env', () => ({
    readEnv: (key: string, fallback: string) => envMock.readEnv(key, fallback),
    isDevMode: () => envMock.isDevMode(),
  }));
  const mod = await import('@/features/schedule/scheduleFeatures');
  if (overrides) {
    vi.unmock('@/sharepoint/fields');
  }
  return mod;
};

afterEach(() => {
  vi.unmock('@/lib/env');
  vi.unmock('@/sharepoint/fields');
  vi.restoreAllMocks();
  envMock.readEnv.mockReset();
  envMock.isDevMode.mockReset();
});

describe('scheduleFeatures flag behaviour', () => {
  it('includes staff text fields in select clause when feature flag enabled', async () => {
    const features = await loadScheduleFeatures('1', true);

    expect(features.isScheduleStaffTextColumnsEnabled()).toBe(true);

    const fields = features.buildScheduleSelectFields();

    for (const field of SCHEDULES_BASE_FIELDS) {
      expect(fields).toContain(field);
    }
    for (const field of SCHEDULES_STAFF_TEXT_FIELDS) {
      expect(fields).toContain(field);
    }
    expect(fields).toContain('@odata.etag');
  });

  it('disables staff text columns when optional field errors mention staff keys', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const features = await loadScheduleFeatures('1', true);

    const result = features.handleScheduleOptionalFieldError(new Error("Missing field 'cr014_staffNames'"));

    expect(result).toBe(true);
    expect(features.isScheduleStaffTextColumnsEnabled()).toBe(false);
    expect(consoleWarn).toHaveBeenCalledTimes(1);
    const [warnMessage] = consoleWarn.mock.calls[0] ?? [];
    expect(warnMessage).toBe('[schedule] Falling back to legacy StaffIdId column due to missing fields.');

    const repeat = features.handleScheduleOptionalFieldError(new Error("Missing field 'cr014_staffNames'"));
    expect(repeat).toBe(false);
  expect(consoleWarn).toHaveBeenCalledTimes(1);
  });

  it('ignores unrelated errors when feature already disabled', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const features = await loadScheduleFeatures('0', true);

    expect(features.isScheduleStaffTextColumnsEnabled()).toBe(false);
    const fields = features.buildScheduleSelectFields();

    for (const field of SCHEDULES_STAFF_TEXT_FIELDS) {
      expect(fields).not.toContain(field);
    }

    const handled = features.handleScheduleOptionalFieldError(new Error('Schema mismatch on other column'));
    expect(handled).toBe(false);
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it('ignores non-error inputs while keeping feature flag enabled', async () => {
    const features = await loadScheduleFeatures('1', true);

    const handledString = features.handleScheduleOptionalFieldError('missing field');
    expect(handledString).toBe(false);
    expect(features.isScheduleStaffTextColumnsEnabled()).toBe(true);

    const handledLiteral = features.handleScheduleOptionalFieldError({ message: 'cr014_staffNames' });
    expect(handledLiteral).toBe(false);
  });

  it('returns canonical select clause when only base fields are present', async () => {
    const features = await loadScheduleFeatures('1', true);

    const clause = features.buildScheduleSelectClause();
    expect(clause).toBe(SCHEDULES_SELECT_FIELDS);
  });

  it('adds custom staff text fields to select clause when provided by SharePoint schema', async () => {
    const features = await loadScheduleFeatures('1', true, {
      baseFields: ['Id', 'Title'],
      staffFields: ['cr014_staffNames', 'cr014_staffContact'],
      selectClause: 'Id,Title',
    });

    const clause = features.buildScheduleSelectClause();
    expect(clause).toContain('cr014_staffNames');
    expect(clause).toContain('cr014_staffContact');
    expect(clause).toContain('@odata.etag');
    expect(clause).not.toBe('Id,Title');
  });

  it('disables staff text columns without logging when runtime is not dev', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const features = await loadScheduleFeatures('1', false);

    const first = features.disableScheduleStaffTextColumns('simulate missing column');
    const second = features.disableScheduleStaffTextColumns('repeat');

    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(features.isScheduleStaffTextColumnsEnabled()).toBe(false);
    expect(consoleWarn).not.toHaveBeenCalled();

    consoleWarn.mockRestore();
  });
});
