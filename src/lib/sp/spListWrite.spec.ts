import { describe, expect, it, vi } from 'vitest';
import { patchListItem } from './spListWrite';

describe('patchListItem assignment conflict policy', () => {
  it('does not refresh or replay an assignment body after 412', async () => {
    const conflict = Object.assign(new Error('412'), { status: 412 });
    const spFetch = vi.fn().mockRejectedValue(conflict);

    await expect(patchListItem(spFetch, 'Schedules', 7, { VehicleId: '車両1' }, '"8,1"', {
      conflictRetry: 'none',
    })).rejects.toBe(conflict);

    expect(spFetch).toHaveBeenCalledTimes(1);
    expect(spFetch.mock.calls[0][1].headers['X-HTTP-Method']).toBe('MERGE');
  });

  it('keeps one conflict refresh for a caller that does not opt out', async () => {
    const conflict = Object.assign(new Error('412'), { status: 412 });
    const spFetch = vi.fn()
      .mockRejectedValueOnce(conflict)
      .mockResolvedValueOnce(new Response(JSON.stringify({ Id: 7 }), { status: 200, headers: { ETag: '"9,1"' } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await patchListItem(spFetch, 'Schedules', 7, { Title: '予定' }, '"8,1"');

    expect(spFetch).toHaveBeenCalledTimes(3);
    expect(spFetch.mock.calls[2][1].headers['If-Match']).toBe('"9,1"');
    expect(spFetch.mock.calls[2][1].body).toBe(JSON.stringify({ Title: '予定' }));
  });
});
