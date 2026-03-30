import { describe, expect, it, vi } from 'vitest';

const loadModule = async (env: Record<string, string | undefined>) => {
  vi.resetModules();
  vi.doMock('@/lib/env', () => ({
    readEnv: (key: string, fallback = '') => env[key] ?? fallback,
    readOptionalEnv: (key: string) => env[key],
  }));
  return import('./scheduleSpUtils');
};

describe('scheduleSpUtils', () => {
  it('uses Schedules-safe fields by default', async () => {
    const mod = await loadModule({});
    const fields = mod.resolveScheduleFieldNames();
    const variants = mod.resolveScheduleFieldVariants();
    const { selectVariants } = mod.buildSelectSets();

    expect(fields).toMatchObject({
      start: 'Start',
      end: 'End',
      serviceType: 'ServiceType',
      locationName: 'LocationName',
      notes: 'Note',
    });
    expect(variants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ start: 'Start', end: 'End' }),
        expect.objectContaining({ start: 'EventDate', end: 'EndDate' }),
      ]),
    );
    expect(selectVariants[0]).toContain('ServiceType');
    expect(selectVariants[0]).toContain('LocationName');
    expect(selectVariants[0]).toContain('Note');
    expect(selectVariants[0]).not.toContain('Category');
    expect(selectVariants[0]).not.toContain('Location');
    expect(selectVariants[0]).not.toContain('Vehicle');
    expect(selectVariants[0]).not.toContain('VehicleId');
  });

  it('uses ScheduleEvents-compatible fields when list title is ScheduleEvents', async () => {
    const mod = await loadModule({ VITE_SCHEDULES_LIST_TITLE: 'ScheduleEvents' });
    const fields = mod.resolveScheduleFieldNames();
    const { eventSafe } = mod.buildSelectSets();

    expect(fields).toMatchObject({
      start: 'EventDate',
      end: 'EndDate',
      serviceType: 'ServiceType',
      locationName: 'Location',
      notes: 'Notes',
    });
    expect(eventSafe).toContain('Location');
    expect(eventSafe).toContain('Notes');
    expect(eventSafe).not.toContain('LocationName');
    expect(eventSafe).not.toContain('Vehicle');
    expect(eventSafe).not.toContain('VehicleId');
  });

  it('encodes datetime literal as UTC with trailing Z and no milliseconds', async () => {
    const mod = await loadModule({});
    const literal = mod.encodeDateLiteral('2026-03-30T05:59:59.999+09:00');

    expect(literal).toMatch(/^datetime'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z'$/);
    expect(literal).not.toContain('.');
  });
});
