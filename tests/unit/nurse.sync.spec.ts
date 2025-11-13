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
    const findOne = vi.fn(async () => null as { id: number } | null);
  const sp = { addItemByTitle, updateItemById, findOne } as unknown as SharePointListApi;

    const payload = {
      UserLookupId: 22,
      ObsDateTime: '2025-11-04T04:32:10.123Z',
      Vital_Temp: 36.6,
      Vital_Pulse: 76,
      Vital_Sys: 118,
      Vital_Dia: 72,
      Vital_SpO2: 97,
      Vital_Weight: 58.2,
      StateTags: { results: [] as string[] },
      Memo: '',
    };

    const first = await upsertObservation(sp, 'Nurse_Observation', payload);
    expect(first).toEqual({ id: 7, updated: false });
  expect(addItemByTitle).toHaveBeenCalledTimes(1);
  expect(updateItemById).not.toHaveBeenCalled();

  findOne.mockResolvedValueOnce({ id: 7 });

    const second = await upsertObservation(sp, 'Nurse_Observation', payload);
    expect(second).toEqual({ id: 7, updated: true });
  expect(updateItemById).toHaveBeenCalledOnce();
    expect(calls[0][0]).toBe('add');
    expect(calls[1][0]).toBe('update');
  });
});
