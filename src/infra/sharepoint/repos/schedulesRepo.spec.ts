import { useSP } from '@/lib/spClient';
import { describe, expect, it, vi } from 'vitest';
import type { UpdateScheduleInput } from './schedulesRepo';

// Mock env.ts to disable writes
vi.mock('@/env', () => ({
  isWriteEnabled: false,
  getRuntimeEnv: () => ({}),
}));

// Import after mock to ensure mocked value is used
const { createSchedule, updateSchedule, removeSchedule, WriteDisabledError } = await import('./schedulesRepo');

describe('schedulesRepo write gate', () => {
  const mockClient = {} as ReturnType<typeof useSP>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockInput: any = {
    title: 'test',
    start: new Date().toISOString(),
    personType: 'User' as const,
    personId: '1',
    end: new Date().toISOString(),
    rowKey: 'mock',
    dayKey: 'mock',
    monthKey: 'mock',
    fiscalYear: '2026',
  };
  const mockUpdateInput: UpdateScheduleInput = { title: 'updated' };

  it('createSchedule throws WriteDisabledError when write is disabled', async () => {
    await expect(() => createSchedule(mockClient, mockInput)).rejects.toThrow(WriteDisabledError);
    await expect(() => createSchedule(mockClient, mockInput)).rejects.toThrow(/Write operation "createSchedule" is disabled/);
  });

  it('updateSchedule throws WriteDisabledError when write is disabled', async () => {
    await expect(() => updateSchedule(mockClient, 1, 'etag', mockUpdateInput)).rejects.toThrow(WriteDisabledError);
    await expect(() => updateSchedule(mockClient, 1, 'etag', mockUpdateInput)).rejects.toThrow(/Write operation "updateSchedule" is disabled/);
  });

  it('removeSchedule throws WriteDisabledError when write is disabled', async () => {
    await expect(() => removeSchedule(mockClient, 1)).rejects.toThrow(WriteDisabledError);
    await expect(() => removeSchedule(mockClient, 1)).rejects.toThrow(/Write operation "removeSchedule" is disabled/);
  });

  it('WriteDisabledError has WRITE_DISABLED code', () => {
    const error = new WriteDisabledError('testOp');
    expect(error.code).toBe('WRITE_DISABLED');
    expect(error.name).toBe('WriteDisabledError');
  });
});
