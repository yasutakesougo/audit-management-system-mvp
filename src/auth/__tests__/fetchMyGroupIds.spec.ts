import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchMyGroupIds } from '../fetchMyGroupIds';

describe('fetchMyGroupIds', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should return empty array when getToken returns null', async () => {
    const getToken = vi.fn().mockResolvedValue(null);
    const result = await fetchMyGroupIds(getToken);
    expect(result).toEqual([]);
    expect(getToken).toHaveBeenCalledOnce();
  });

  it('should fetch group IDs from transitiveMemberOf endpoint', async () => {
    const getToken = vi.fn().mockResolvedValue('mock-token');
    const mockGroupIds = [
      { id: 'group-1' },
      { id: 'group-2' },
      { id: 'group-3' },
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ value: mockGroupIds }),
    });

    const result = await fetchMyGroupIds(getToken);
    expect(result).toEqual(['group-1', 'group-2', 'group-3']);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('transitiveMemberOf'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token',
        }),
      }),
    );
  });

  it('should handle pagination via @odata.nextLink', async () => {
    const getToken = vi.fn().mockResolvedValue('mock-token');

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ id: 'group-1' }],
          '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/transitiveMemberOf?$skiptoken=abc',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ id: 'group-2' }],
        }),
      });

    const result = await fetchMyGroupIds(getToken);
    expect(result).toEqual(['group-1', 'group-2']);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('should fall back to memberOf endpoint when transitiveMemberOf fails', async () => {
    const getToken = vi.fn().mockResolvedValue('mock-token');

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          value: [{ id: 'fallback-group' }],
        }),
      });

    const result = await fetchMyGroupIds(getToken);
    expect(result).toEqual(['fallback-group']);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('memberOf'),
      expect.any(Object),
    );
  });

  it('should throw when both endpoints fail', async () => {
    const getToken = vi.fn().mockResolvedValue('mock-token');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'Internal Server Error',
    });

    await expect(fetchMyGroupIds(getToken)).rejects.toThrow('memberOf failed: 500');
  });

  it('should filter out entries without valid id', async () => {
    const getToken = vi.fn().mockResolvedValue('mock-token');

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        value: [
          { id: 'valid-1' },
          { id: '' },
          { id: undefined },
          {},
          { id: 'valid-2' },
        ],
      }),
    });

    const result = await fetchMyGroupIds(getToken);
    expect(result).toEqual(['valid-1', 'valid-2']);
  });
});
