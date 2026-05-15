import { describe, expect, it, vi } from 'vitest';
import type { IDataProvider } from '@/lib/data/dataProvider.interface';
import { DataProviderAttendanceRepository } from '../DataProviderAttendanceRepository';
import { ATTENDANCE_DAILY_LIST_TITLE } from '@/sharepoint/fields/attendanceFields';

const createMockProvider = (overrides: Partial<IDataProvider> = {}): IDataProvider => ({
  listItems: overrides.listItems ?? vi.fn(async () => []),
  getItemById: overrides.getItemById ?? vi.fn(),
  createItem: overrides.createItem ?? vi.fn(),
  updateItem: overrides.updateItem ?? vi.fn(),
  deleteItem: overrides.deleteItem ?? vi.fn(),
  getMetadata: overrides.getMetadata ?? vi.fn(async () => ({})),
  getResourceNames: overrides.getResourceNames ?? vi.fn(async () => [ATTENDANCE_DAILY_LIST_TITLE]),
  getFieldInternalNames: overrides.getFieldInternalNames ?? vi.fn(async () => new Set(['Id', 'Title', 'UserCode', 'RecordDate', 'Status', 'CheckInAt'])),
  ensureListExists: overrides.ensureListExists ?? vi.fn(),
});

describe('DataProviderAttendanceRepository Fallback', () => {
  it('should pass onFieldRemoved callback to provider in getDailyByDate', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listItems = vi.fn(async (resource: string, options: any) => {
      // Simulate field removal by calling the callback
      if (options.onFieldRemoved) {
        options.onFieldRemoved('CheckInAt', 400, 'Field not found');
      }
      return [];
    }) as unknown as any;

    const provider = createMockProvider({ listItems });
    const repo = new DataProviderAttendanceRepository({ provider });

    await repo.getDailyByDate({ recordDate: '2026-05-15' });

    expect(listItems).toHaveBeenCalled();
    const lastCall = listItems.mock.calls[0];
    expect(lastCall[1]).toHaveProperty('onFieldRemoved');
    expect(typeof lastCall[1].onFieldRemoved).toBe('function');
  });

  it('should pass onCriticalFallback callback to provider in getDailyByDate', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const listItems = vi.fn(async (resource: string, options: any) => {
      if (options.onCriticalFallback) {
        options.onCriticalFallback(500, 'Server error');
      }
      return [];
    }) as unknown as any;

    const provider = createMockProvider({ listItems });
    const repo = new DataProviderAttendanceRepository({ provider });

    await repo.getDailyByDate({ recordDate: '2026-05-15' });

    expect(listItems).toHaveBeenCalled();
    const lastCall = listItems.mock.calls[0];
    expect(lastCall[1]).toHaveProperty('onCriticalFallback');
    expect(typeof lastCall[1].onCriticalFallback).toBe('function');
  });
});
