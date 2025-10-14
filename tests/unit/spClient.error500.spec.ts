import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSpClient } from '@/lib/spClient';

const mockFetchResponse = (body: unknown, status = 500): Response => ({
  ok: false,
  status,
  statusText: 'Internal Server Error',
  headers: {
    get: () => 'application/json',
  } as unknown as Headers,
  text: async () => JSON.stringify(body),
  json: async () => body,
}) as unknown as Response;

const errorPayload = {
  'odata.error': {
    code: '500',
    message: { value: 'Internal Boom' },
  },
};

describe('spClient 500 handling', () => {
  const acquireToken = vi.fn().mockResolvedValue('fake-token');

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => mockFetchResponse(errorPayload)));
    acquireToken.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('raises error containing OData message when SharePoint returns 500', async () => {
    const client = createSpClient(acquireToken, 'https://contoso.sharepoint.com/sites/app/_api/web');

    await expect(
      client.addListItemByTitle('SupportRecord_Daily', { Title: 'X' })
    ).rejects.toThrowError(/Internal Boom/);
  });
});
