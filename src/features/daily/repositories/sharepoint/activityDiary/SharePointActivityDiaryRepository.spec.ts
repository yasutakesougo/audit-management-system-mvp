import { describe, expect, it, vi } from 'vitest';
import type { ADMapping } from './constants';
import { getADListTitle } from './constants';
import { SharePointActivityDiaryRepository } from './SharePointActivityDiaryRepository';
import type { SpFetchFn } from '@/lib/sp/spLists';
import type { ActivityDiaryUpsert } from '@/features/daily/domain/activityDiaryTypes';

const mockResolve = vi.fn();
const mockLoadByDate = vi.fn();
const mockSave = vi.fn();

vi.mock('./modules/SchemaResolver', () => ({
  ActivityDiarySchemaResolver: class {
    public resolve = mockResolve;

    public constructor() {}
  },
}));

vi.mock('./modules/DataAccess', () => ({
  ActivityDiaryDataAccess: class {
    public loadByDate = mockLoadByDate;

    public constructor() {}
  },
}));

vi.mock('./modules/Saver', () => ({
  ActivityDiarySaver: class {
    public save = mockSave;

    public constructor() {}
  },
}));

describe('SharePointActivityDiaryRepository', () => {
  it('schema が解決できない場合は保存で例外を投げる', async () => {
    const resolver = new SharePointActivityDiaryRepository({ spFetch: vi.fn<SpFetchFn>() });

    mockResolve.mockResolvedValueOnce(null);

    const input: ActivityDiaryUpsert = {
      userId: 1,
      dateISO: '2026-06-10',
      period: 'AM',
      category: '請負',
      mealMain: undefined,
      mealSide: undefined,
      behavior: { has: false, kinds: [] },
      seizure: { has: false, at: undefined },
      goalIds: [],
      notes: undefined,
    };

    await expect(
      resolver.save(input, undefined),
    ).rejects.toThrow(`Activity diary list not found or schema mismatch: ${getADListTitle()}`);

    expect(mockSave).not.toHaveBeenCalled();
  });

  it('既存レコードと同一シフト/カテゴリがあれば保存時に既存IDで更新する', async () => {
    const resolverValue = {
      listPath: '/lists/ActivityDiary',
      mapping: {
        shift: 'Shift',
        category: 'Category',
      } as ADMapping,
    };

    mockResolve.mockResolvedValueOnce(resolverValue);
    mockLoadByDate.mockResolvedValueOnce([
      {
        Id: '999',
        Shift: 'AM',
        Category: '請負',
      },
    ]);
    mockSave.mockResolvedValueOnce({ id: 999 });

    const repo = new SharePointActivityDiaryRepository({ spFetch: vi.fn<SpFetchFn>() });

    const input: ActivityDiaryUpsert = {
      userId: 1,
      dateISO: '2026-06-10',
      period: 'AM',
      category: '請負',
      mealMain: undefined,
      mealSide: undefined,
      behavior: { has: true, kinds: ['離席'] },
      seizure: { has: false, at: undefined },
      goalIds: [1],
      notes: 'ノート',
    };

    await repo.save(input);

    expect(mockLoadByDate).toHaveBeenCalledWith('2026-06-10', 1, '/lists/ActivityDiary', resolverValue.mapping, undefined);
    expect(mockSave).toHaveBeenCalledWith(input, '/lists/ActivityDiary', getADListTitle(), resolverValue.mapping, 999);
  });
});
