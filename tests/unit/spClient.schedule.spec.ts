import type { Schedule, ScheduleOrg, ScheduleUserCare } from '@/features/schedule/types';
import type { UseSP } from '@/lib/spClient';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFromSpSchedule = vi.hoisted(() => vi.fn());
const mockToSpScheduleFields = vi.hoisted(() => vi.fn());
const mockValidateUserCare = vi.hoisted(() => vi.fn());
const mockBuildSelect = vi.hoisted(() => vi.fn(() => 'Id,Title'));
const mockHandleOptional = vi.hoisted(() => vi.fn(() => false));
const mockSpWriteResilient = vi.hoisted(() => vi.fn());
const mockReadEnv = vi.hoisted(() => vi.fn<(key?: string, fallback?: string) => string>(() => ''));

vi.mock('@/features/schedule/spMap', () => ({
  fromSpSchedule: mockFromSpSchedule,
  toSpScheduleFields: mockToSpScheduleFields,
}));

vi.mock('@/features/schedule/validation', () => ({
  validateUserCare: mockValidateUserCare,
}));

vi.mock('@/features/schedule/statusDictionary', () => ({
  STATUS_DEFAULT: 'DefaultStatus',
}));

vi.mock('@/features/schedule/scheduleFeatures', () => ({
  buildScheduleSelectClause: mockBuildSelect,
  handleScheduleOptionalFieldError: mockHandleOptional,
}));

vi.mock('@/lib/spWrite', () => ({
  spWriteResilient: mockSpWriteResilient,
}));

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    readEnv: (key: string, fallback = '', _envOverride?: unknown) =>
      mockReadEnv(key, fallback ?? ''),
  };
});

type FakeResponse = {
  json: () => Promise<unknown>;
  status?: number;
  headers?: { get: (key: string) => string | null };
};

const baseSchedule: ScheduleUserCare = {
  id: '1',
  etag: 'etag-1',
  category: 'User',
  title: '訪問',
  start: '2025-01-01T00:00:00.000Z',
  end: '2025-01-01T01:00:00.000Z',
  allDay: false,
  status: '承認済み',
  location: undefined,
  notes: undefined,
  recurrenceRule: undefined,
  dayKey: undefined,
  fiscalYear: undefined,
  serviceType: '一時ケア',
  personType: 'Internal',
  personId: undefined,
  personName: undefined,
  externalPersonName: undefined,
  externalPersonOrg: undefined,
  externalPersonContact: undefined,
  staffIds: [],
  staffNames: undefined,
};

const mockSchedule = (): ScheduleUserCare => ({ ...baseSchedule });

const toUseSp = (value: { spFetch: ReturnType<typeof vi.fn> }): UseSP => value as unknown as UseSP;

describe('spClient.schedule user care adapter', () => {
  beforeEach(() => {
    vi.resetModules();
    mockFromSpSchedule.mockReset();
    mockFromSpSchedule.mockImplementation(() => mockSchedule());
    mockToSpScheduleFields.mockReset();
    mockToSpScheduleFields.mockReturnValue({ Title: 'mock' });
    mockValidateUserCare.mockReset();
    mockBuildSelect.mockReset();
    mockBuildSelect.mockReturnValue('Id,Title');
    mockHandleOptional.mockReset();
    mockHandleOptional.mockReturnValue(false);
    mockSpWriteResilient.mockReset();
    mockReadEnv.mockReset();
    mockReadEnv.mockReturnValue('');
  });

  it('retries schedule fetch when optional field error is handled', async () => {
    const error = new Error('missing optional field');
    mockHandleOptional.mockImplementationOnce(() => true).mockReturnValue(false);

    const payload = { value: [{ Id: 10, '@odata.etag': '"1"' }] };
    const response: FakeResponse = { json: async () => payload };

    const sp = {
      spFetch: vi
        .fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(response),
    };

    const { getUserCareSchedules } = await import('@/features/schedule/spClient.schedule');

    const result = await getUserCareSchedules(toUseSp(sp), {
      start: '2025-01-01T00:00:00.000Z',
      end: '2025-01-02T00:00:00.000Z',
      keyword: '訪問',
      personType: 'External',
      serviceType: 'ショートステイ',
      top: 5,
    });

    expect(result).toHaveLength(1);
    expect(sp.spFetch).toHaveBeenCalledTimes(2);
    const lastCall = sp.spFetch.mock.calls[1]?.[0];
    const decoded = decodeURIComponent(String(lastCall));
    expect(decoded).toContain("substringof('訪問'");
    expect(mockHandleOptional).toHaveBeenCalled();
  });

  it('throws when SharePoint payload is not a user schedule', async () => {
    const orgSchedule: Schedule = {
      id: '2',
      etag: 'etag-2',
      category: 'Org',
      title: 'Org Meeting',
      start: baseSchedule.start,
      end: baseSchedule.end,
      allDay: false,
      status: '承認済み',
      subType: '会議',
    } satisfies ScheduleOrg;
    mockFromSpSchedule.mockImplementation(() => orgSchedule);
    const response: FakeResponse = { json: async () => ({ value: [{ Id: 1 }] }) };
    const sp = { spFetch: vi.fn().mockResolvedValue(response) };

    const { getUserCareSchedules } = await import('@/features/schedule/spClient.schedule');

    await expect(
      getUserCareSchedules(toUseSp(sp), {
        start: '2025-01-01T00:00:00.000Z',
        end: '2025-01-02T00:00:00.000Z',
      })
    ).rejects.toThrow('Expected User schedule');
  });

  it('propagates conflict deletions with http status metadata', async () => {
    const conflict = Object.assign(new Error('conflict'), { code: 'conflict' });
    mockSpWriteResilient.mockResolvedValue({ ok: false, error: conflict });

    const { deleteUserCare } = await import('@/features/schedule/spClient.schedule');

    await expect(deleteUserCare({} as unknown as UseSP, { id: '42', etag: 'etag' })).rejects.toMatchObject({
      code: 'conflict',
      _httpStatus: 412,
    });
  });

  it('rejects invalid monthly parameters early', async () => {
    const { getMonthlySchedule } = await import('@/features/schedule/spClient.schedule');

    await expect(getMonthlySchedule({} as unknown as UseSP, { year: 2025, month: 13 })).rejects.toThrow('Invalid month value');
    await expect(getMonthlySchedule({} as unknown as UseSP, { year: 1960, month: 1 })).rejects.toThrow('Invalid year value');
  });

  it('fetches monthly schedules with normalized single object payload', async () => {
    const payload = { Id: 99, '@odata.etag': '"etag"' };
    const response: FakeResponse = { json: async () => payload };
    const sp = { spFetch: vi.fn().mockResolvedValue(response) };

    const { getMonthlySchedule } = await import('@/features/schedule/spClient.schedule');

    const results = await getMonthlySchedule(toUseSp(sp), { year: 2025, month: 2, top: 10 });

    expect(results).toHaveLength(1);
    expect(sp.spFetch).toHaveBeenCalledTimes(1);
  const call = sp.spFetch.mock.calls[0]?.[0];
  expect(decodeURIComponent(String(call))).toContain('$filter');
    expect(mockFromSpSchedule).toHaveBeenCalled();
  });
});
