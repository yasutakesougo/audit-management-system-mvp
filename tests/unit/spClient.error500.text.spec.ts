import { createSpClient } from '@/lib/spClient';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const textPayload = 'Internal Boom (plain text)';

const createResponse = (): Response => ({
  ok: false,
  status: 500,
  statusText: 'Internal Server Error',
  headers: {
    get: (key: string) => (key.toLowerCase() === 'content-type' ? 'text/plain' : null),
  } as unknown as Headers,
  json: async () => { throw new Error('Unexpected JSON parse'); },
  text: async () => textPayload,
}) as unknown as Response;

describe('spClient text 500 handling', () => {
  const acquireToken = vi.fn().mockResolvedValue('token');

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => createResponse()));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('surfaces plain text body when JSON parsing fails', async () => {
    const client = createSpClient(acquireToken, 'https://contoso.sharepoint.com/sites/app/_api/web');

    await expect(
      client.addListItemByTitle('SupportRecord_Daily', { Title: 'Plain' })
    ).rejects.toThrow(/Internal Boom/);
  });
});
