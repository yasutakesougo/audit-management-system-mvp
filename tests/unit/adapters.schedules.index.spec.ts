import type { ScheduleDraft } from '@/adapters/schedules/demo';
import * as demo from '@/adapters/schedules/demo';
import { mapSchedule } from '@/lib/mappers';
import { SCHEDULE_FIELD_END, SCHEDULE_FIELD_START, type ScheduleRow } from '@/sharepoint/fields';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  isDemoModeEnabled,
  allowWriteFallback,
  sharepointList,
  sharepointCreate,
  sharepointUpdate,
  sharepointRemove,
  sharepointCheckConflicts,
} = vi.hoisted(() => ({
  isDemoModeEnabled: vi.fn(),
  allowWriteFallback: vi.fn(),
  sharepointList: vi.fn(),
  sharepointCreate: vi.fn(),
  sharepointUpdate: vi.fn(),
  sharepointRemove: vi.fn(),
  sharepointCheckConflicts: vi.fn(),
}));

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    isDemoModeEnabled,
    allowWriteFallback,
  };
});

vi.mock('@/adapters/schedules/sharepoint', () => ({
  list: sharepointList,
  create: sharepointCreate,
  update: sharepointUpdate,
  remove: sharepointRemove,
  checkConflicts: sharepointCheckConflicts,
}));

describe('schedules adapter index', () => {
  let schedules: typeof import('@/adapters/schedules/index');

  beforeAll(async () => {
    schedules = await import('@/adapters/schedules/index');
  });

  beforeEach(() => {
    demo.__resetForTests();
    schedules.__resetSchedulesWarningForTest();
    vi.clearAllMocks();
    isDemoModeEnabled.mockReturnValue(false);
    allowWriteFallback.mockReturnValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const draft = (overrides: Partial<ScheduleDraft> = {}): ScheduleDraft => ({
    assignee: 'staff-001',
    title: 'Visit',
    start: new Date('2025-01-10T09:00:00Z').toISOString(),
    end: new Date('2025-01-10T10:00:00Z').toISOString(),
    ...overrides,
  });

  it('returns demo data immediately in demo mode', async () => {
    isDemoModeEnabled.mockReturnValue(true);
    const spy = vi.spyOn(demo, 'list');
    const seeded = await demo.create(draft());
    const day = seeded.start.slice(0, 10);
    const result = await schedules.list(day);
    expect(result.source).toBe('demo');
    expect(result.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: seeded.id })]));
    expect(sharepointList).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
  });

  it('throws on invalid day ISO input before calling SharePoint', async () => {
    await expect(schedules.list('2025/01/10')).rejects.toThrow(/invalid dayISO/);
    expect(sharepointList).not.toHaveBeenCalled();
  });

  it('falls back to demo data on SharePoint list failure and classifies error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const seeded = await demo.create(draft());
    const day = seeded.start.slice(0, 10);
    sharepointList.mockRejectedValue(new Error('503 Service Unavailable'));

    const result = await schedules.list(day);

    expect(result.source).toBe('demo');
    expect(result.fallbackKind).toBe('network');
    expect(result.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: seeded.id })]));
    expect(warn).toHaveBeenCalledWith(
      '[schedules] SharePoint list failed, falling back to demo data.',
      '操作に失敗しました。時間をおいて再度お試しください。',
      expect.objectContaining({ message: '503 Service Unavailable' })
    );
  });

  it('rethrows safe error when abort signal is already aborted', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const controller = new AbortController();
    controller.abort();
    sharepointList.mockRejectedValue(new Error('timeout while fetching'));

    await expect(schedules.list('2025-01-10', { signal: controller.signal })).rejects.toMatchObject({
      userMessage: '操作に失敗しました。時間をおいて再度お試しください。',
    });
    expect(warn).toHaveBeenCalled();
  });

  it('falls back to demo create when SharePoint create fails and write fallback allowed', async () => {
    sharepointCreate.mockRejectedValue(new Error('schema mismatch: field missing'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await schedules.create(draft({ note: 'fallback create' }));

    expect(result.source).toBe('demo');
    expect(result.schedule.note).toBe('fallback create');
    expect(result.fallbackKind).toBe('schema');
    expect(warn).toHaveBeenCalledWith(
      '[schedules] SharePoint create failed, falling back to demo.',
      expect.stringContaining('項目定義が最新ではありません。'),
      expect.objectContaining({ message: 'schema mismatch: field missing' })
    );
  });

  it('propagates error when write fallback is disabled', async () => {
    allowWriteFallback.mockReturnValue(false);
    sharepointCreate.mockRejectedValue(new Error('403 forbidden'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(schedules.create(draft())).rejects.toMatchObject({ message: '403 forbidden' });
    expect(warn).toHaveBeenCalled();
  });

  it('emits warning only once for repeated SharePoint create failures', async () => {
    sharepointCreate.mockRejectedValue(new Error('network timeout'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const first = await schedules.create(draft({ title: 'first attempt' }));
    const second = await schedules.create(draft({ title: 'second attempt' }));

    expect(first.source).toBe('demo');
    expect(second.source).toBe('demo');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('throws safe error when create signal is aborted before fallback', async () => {
    sharepointCreate.mockRejectedValue(new Error('network delay exceeds SLA'));
    const controller = new AbortController();
    controller.abort();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const demoCreate = vi.spyOn(demo, 'create');

    await expect(schedules.create(draft(), { signal: controller.signal })).rejects.toMatchObject({
      userMessage: '操作に失敗しました。時間をおいて再度お試しください。',
    });
    expect(demoCreate).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[schedules] SharePoint create failed, falling back to demo.',
      '操作に失敗しました。時間をおいて再度お試しください。',
      expect.objectContaining({ message: 'network delay exceeds SLA' })
    );
  });

  it('falls back to demo update and remove flows based on allowWriteFallback', async () => {
    const created = await demo.create(draft());
    sharepointUpdate.mockRejectedValue(new Error('network timeout'));
    sharepointRemove.mockRejectedValue(new Error('network timeout'));

    const updated = await schedules.update(created.id, { title: 'Updated' });
    expect(updated.title).toBe('Updated');

    await expect(schedules.remove(created.id)).resolves.toBeUndefined();
    const remaining = await demo.list();
    expect(remaining.some((item) => item.id === created.id)).toBe(false);
  });

  it('throws safe error when update signal is aborted before fallback runs', async () => {
    sharepointUpdate.mockRejectedValue(new Error('gateway timeout'));
    const controller = new AbortController();
    controller.abort();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const demoUpdate = vi.spyOn(demo, 'update');

    await expect(
      schedules.update('schedule-123', { title: 'noop' }, { signal: controller.signal })
    ).rejects.toMatchObject({
      userMessage: '操作に失敗しました。時間をおいて再度お試しください。',
    });
    expect(demoUpdate).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[schedules] SharePoint update failed, falling back to demo.',
      '操作に失敗しました。時間をおいて再度お試しください。',
      expect.objectContaining({ message: 'gateway timeout' })
    );
  });

  it('throws safe error when remove signal is aborted before fallback runs', async () => {
    sharepointRemove.mockRejectedValue(new Error('network disconnect'));
    const controller = new AbortController();
    controller.abort();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const demoRemove = vi.spyOn(demo, 'remove');

    await expect(schedules.remove('schedule-123', { signal: controller.signal })).rejects.toMatchObject({
      userMessage: '操作に失敗しました。時間をおいて再度お試しください。',
    });
    expect(demoRemove).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[schedules] SharePoint remove failed, falling back to demo.',
      '操作に失敗しました。時間をおいて再度お試しください。',
      expect.objectContaining({ message: 'network disconnect' })
    );
  });

  it('falls back to demo conflict check if SharePoint rejects', async () => {
    const seeded = await demo.create(draft());
    sharepointCheckConflicts.mockRejectedValue(new Error('503 maintenance window'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const demoCheck = vi.spyOn(demo, 'checkConflicts');

    const result = await schedules.checkConflicts(
      seeded.assignee,
      seeded.start,
      seeded.end,
      { signal: undefined }
    );

    expect(result).toBe(true);
    expect(demoCheck).toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[schedules] SharePoint conflict-check failed, falling back to demo.',
      '操作に失敗しました。時間をおいて再度お試しください。',
      expect.objectContaining({ message: '503 maintenance window' })
    );
  });

  it('throws safe error when conflict check signal is aborted', async () => {
    sharepointCheckConflicts.mockRejectedValue(new Error('network offline'));
    const controller = new AbortController();
    controller.abort();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const demoCheck = vi.spyOn(demo, 'checkConflicts');

    await expect(
      schedules.checkConflicts('staff-777', '2025-01-01T00:00:00Z', '2025-01-01T01:00:00Z', {
        signal: controller.signal,
      })
    ).rejects.toMatchObject({
      userMessage: '操作に失敗しました。時間をおいて再度お試しください。',
    });
    expect(demoCheck).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[schedules] SharePoint conflict-check failed, falling back to demo.',
      '操作に失敗しました。時間をおいて再度お試しください。',
      expect.objectContaining({ message: 'network offline' })
    );
  });

  it('classifies unrecognized SharePoint failures as unknown fallback kind', async () => {
    sharepointList.mockRejectedValue(new Error('catastrophic failure without hints'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await schedules.list('2025-01-10');

    expect(result.fallbackKind).toBe('unknown');
    expect(warn).toHaveBeenCalledWith(
      '[schedules] SharePoint list failed, falling back to demo data.',
      '操作に失敗しました。時間をおいて再度お試しください。',
      expect.objectContaining({ message: 'catastrophic failure without hints' })
    );
  });

  it('falls back to legacy staff identifiers and names when modern lookups are empty', () => {
    const row = {
      Id: 99,
      Title: '',
      [SCHEDULE_FIELD_START]: '2025-05-01T01:00:00Z',
      [SCHEDULE_FIELD_END]: '2025-05-01T02:00:00Z',
      cr014_staffIds: '21;#21;#22',
      cr014_staffNames: ' 佐藤 ;#鈴木 ',
      cr014_category: ' Legacy ',
      cr014_staffLookupId: null,
      cr014_staffLookup: null,
    } as unknown as ScheduleRow;

    const schedule = mapSchedule(row);

    expect(schedule.staffIds).toEqual(['21', '22']);
    expect(schedule.staffNames).toEqual(['佐藤', '鈴木']);
    expect(schedule.category).toBe('Legacy');
    expect(schedule.staffId).toBeNull();
  });
});
