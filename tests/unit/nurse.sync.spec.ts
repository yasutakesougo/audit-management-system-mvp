import type { SharePointListApi } from '@/features/nurse/sp/client';
import { upsertObservation } from '@/features/nurse/sp/upsert';
import { describe, expect, it, vi } from 'vitest';

describe('nurse SharePoint upsert', () => {
  it('adds observation when none exists and updates on subsequent call', async () => {
    const calls: Array<['add' | 'update', unknown]> = [];
    const addItemByTitle = vi.fn(async (_listTitle: string, payload: unknown) => {
        calls.push(['add', payload]);
        return { id: 7 };
      });
    const updateItemById = vi.fn(async (_listTitle: string, id: number, payload: unknown) => {
        calls.push(['update', { id, payload }]);
      });
    const findOne = vi.fn(async (_options: { listTitle: string; filter: string; select?: string[]; top?: number }) => null as { id: number } | null);
    const sp = { addItemByTitle, updateItemById, findOne } as unknown as SharePointListApi;

    const payload = {
      UserLookupId: 22,
      ObservedAt: '2025-11-04T04:32:10.123Z',
      Temperature: 36.6,
      Pulse: 76,
      Systolic: 118,
      Diastolic: 72,
      SpO2: 97,
      Weight: 58.2,
      Tags: null,
      Memo: '',
      IdempotencyKey: 'test-key-123',
      Source: 'test',
    };

    const first = await upsertObservation(sp, 'Nurse_Observation', payload);
    expect(first).toEqual({ id: 7, created: true });
    expect(addItemByTitle).toHaveBeenCalledTimes(1);
    expect(updateItemById).not.toHaveBeenCalled();

    findOne.mockResolvedValueOnce({ id: 7 });

    const second = await upsertObservation(sp, 'Nurse_Observation', payload);
    expect(second).toEqual({ id: 7, created: false });
  expect(updateItemById).toHaveBeenCalledOnce();
    expect(calls[0][0]).toBe('add');
    expect(calls[1][0]).toBe('update');
  });
});
