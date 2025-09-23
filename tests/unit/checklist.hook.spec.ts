import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useChecklistApi } from '../../src/features/compliance-checklist/api';

const getListItemsByTitle = vi.fn();
const addListItemByTitle = vi.fn();

vi.mock('../../src/lib/spClient', () => ({
  useSP: () => ({ getListItemsByTitle, addListItemByTitle })
}));

describe('useChecklistApi', () => {
  beforeEach(() => {
    getListItemsByTitle.mockReset();
    addListItemByTitle.mockReset();
  });

  it('list maps DTO to domain shape', async () => {
    getListItemsByTitle.mockResolvedValueOnce([
      { Id: 1, Title: 'Row', cr013_key: 'k', cr013_value: 'v', cr013_note: 'n' }
    ]);
    const api = useChecklistApi();
    const rows = await api.list();
    expect(rows[0]).toEqual({ id: 'k', label: 'Row', value: 'v', note: 'n', required: undefined });
  });

  it('add returns mapped created item', async () => {
    addListItemByTitle.mockResolvedValueOnce({ Id: 5, Title: 'New', cr013_key: 'k2', cr013_value: 'v2', cr013_note: 'n2' });
    const api = useChecklistApi();
    const created = await api.add({ Title: 'New', cr013_key: 'k2', cr013_value: 'v2', cr013_note: 'n2' } as any);
    expect(created).toEqual({ id: 'k2', label: 'New', value: 'v2', note: 'n2', required: undefined });
  });
});
