import { describe, it, expect, vi, beforeEach } from 'vitest';

// We will import the hook factory and mock useSP it depends on.
import { useRecordsApi } from '../../src/features/records/api';

const getListItemsByTitle = vi.fn();
const addListItemByTitle = vi.fn();

vi.mock('../../src/lib/spClient', () => ({
  useSP: () => ({ getListItemsByTitle, addListItemByTitle })
}));

describe('useRecordsApi', () => {
  beforeEach(() => {
    getListItemsByTitle.mockReset();
    addListItemByTitle.mockReset();
  });

  it('list delegates to getListItemsByTitle with expected args and returns items', async () => {
    getListItemsByTitle.mockResolvedValueOnce([{ Id: 1, Title: 'R1' }]);
    const api = useRecordsApi();
    const rows = await api.list();
    expect(rows.length).toBe(1);
    expect(getListItemsByTitle).toHaveBeenCalledTimes(1);
    const args = getListItemsByTitle.mock.calls[0];
    expect(args[0]).toBe('SupportRecord_Daily');
    expect(args[1]).toEqual(['Id','Title','cr013_recorddate','cr013_specialnote']);
    expect(args[3]).toBe('Id desc');
    expect(args[4]).toBe(200);
  });

  it('add delegates to addListItemByTitle and returns created row', async () => {
    addListItemByTitle.mockResolvedValueOnce({ Id: 99, Title: 'Created' });
    const api = useRecordsApi();
    const created = await api.add({ Title: 'X' } as any);
    expect(created.Id).toBe(99);
    expect(addListItemByTitle).toHaveBeenCalledWith('SupportRecord_Daily', { Title: 'X' });
  });
});
