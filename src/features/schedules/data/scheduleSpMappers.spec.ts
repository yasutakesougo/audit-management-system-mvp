import { describe, expect, it, vi } from 'vitest';

const loadModule = async (env: Record<string, string | undefined>) => {
  vi.resetModules();
  vi.doMock('@/lib/env', () => ({
    readEnv: (key: string, fallback = '') => env[key] ?? fallback,
    readOptionalEnv: (key: string) => env[key],
  }));
  return import('./scheduleSpMappers');
};

describe('scheduleSpMappers', () => {
  it('builds select set without event-only fields for default Schedules list', async () => {
    const mod = await loadModule({});
    const fields = mod.resolveScheduleFieldNames();
    const variants = mod.resolveScheduleFieldVariants();
    const { selectVariants } = mod.buildSelectSets();

    expect(fields).toMatchObject({
      start: 'EventDate',
      end: 'EndDate',
      serviceType: 'ServiceType',
      locationName: 'Location',
    });
    expect(variants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ start: 'Start', end: 'End' }),
        expect.objectContaining({ start: 'EventDate', end: 'EndDate' }),
      ]),
    );
    expect(selectVariants[0]).toContain('ServiceType');
    expect(selectVariants[0]).toContain('Location');
    expect(selectVariants[0]).not.toContain('Category');
    expect(selectVariants[0]).not.toContain('LocationName');
    expect(selectVariants[0]).not.toContain('Vehicle');
    expect(selectVariants[0]).not.toContain('VehicleId');
  });

  it('builds ScheduleEvents-safe field selection when list title is ScheduleEvents', async () => {
    const mod = await loadModule({ VITE_SCHEDULES_LIST_TITLE: 'ScheduleEvents' });
    const fields = mod.resolveScheduleFieldNames();
    const { eventSafe } = mod.buildSelectSets();

    expect(fields).toMatchObject({
      start: 'EventDate',
      end: 'EndDate',
      serviceType: 'ServiceType',
      locationName: 'Location',
    });
    expect(eventSafe).toContain('Location');
    expect(eventSafe).not.toContain('LocationName');
    expect(eventSafe).not.toContain('Vehicle');
    expect(eventSafe).not.toContain('VehicleId');
  });

  it('maps RepoSchedule to SchedItem with statusLabel', async () => {
    const mod = await loadModule({});
    const repo = {
      id: 123,
      title: 'Test Schedule',
      eventDate: '2024-04-27T10:00:00Z',
      endDate: '2024-04-27T11:00:00Z',
      status: 'Planned',
      personType: 'User',
      personName: 'Test User',
    } as any;

    const result = mod.mapRepoScheduleToSchedItem(repo);
    expect(result).toMatchObject({
      id: '123',
      title: 'Test Schedule',
      status: 'Planned',
      statusLabel: '予定どおり',
    });
  });
});
