import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('useRecordsApi', () => {
  const listItemsMock = vi.fn();
  const addItemMock = vi.fn();

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    listItemsMock.mockReset();
    addItemMock.mockReset();

    listItemsMock.mockResolvedValueOnce([
      {
        Id: 1,
        Title: 'Daily Note',
        cr013_recorddate: '2024-10-14',
        cr013_specialnote: 'ok',
      },
    ]);

    addItemMock.mockResolvedValueOnce({
      Id: 2,
      Title: 'New Note',
      cr013_recorddate: '2024-10-15',
      cr013_specialnote: 'created',
    });

    vi.doMock('../../src/lib/spClient', () => ({
      useSP: () => ({
        getListItemsByTitle: listItemsMock,
        addListItemByTitle: addItemMock,
      }),
    }));
  });

  afterEach(() => {
    vi.doUnmock('../../src/lib/spClient');
    vi.restoreAllMocks();
  });

  it('delegates list to SharePoint client with correct select and order', async () => {
    const { useRecordsApi } = await import('../../src/features/records/api');
    const api = useRecordsApi();

    const result = await api.list();

    expect(listItemsMock).toHaveBeenCalledWith(
      'SupportRecord_Daily',
      ['Id', 'Title', 'cr013_recorddate', 'cr013_specialnote'],
      undefined,
      'Id desc',
      200,
    );
    expect(result).toEqual([
      {
        Id: 1,
        Title: 'Daily Note',
        cr013_recorddate: '2024-10-14',
        cr013_specialnote: 'ok',
      },
    ]);
  });

  it('delegates add to SharePoint client with provided payload', async () => {
    const { useRecordsApi } = await import('../../src/features/records/api');
    const api = useRecordsApi();

    const body = {
      Title: 'New Note',
      cr013_recorddate: '2024-10-15',
      cr013_specialnote: 'created',
    };

    const result = await api.add(body);

    expect(addItemMock).toHaveBeenCalledWith('SupportRecord_Daily', body);
    expect(result).toEqual({
      Id: 2,
      Title: 'New Note',
      cr013_recorddate: '2024-10-15',
      cr013_specialnote: 'created',
    });
  });
});
