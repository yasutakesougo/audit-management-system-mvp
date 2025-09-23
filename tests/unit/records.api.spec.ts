import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSpClient } from '../../src/lib/spClient';

// We'll directly test the client addListItemByTitle failure path which powers useRecordsApi.add
// Simulate a 500 server error and ensure the promise rejects with meaningful message

describe('records add failure (500)', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let acquireToken: any;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch' as any);
    acquireToken = vi.fn().mockResolvedValue('tok');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('propagates server error message on 500', async () => {
    fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ 'odata.error': { message: { value: 'Internal Boom' } } }), { status: 500 }));

    const client = createSpClient(acquireToken, 'https://contoso.sharepoint.com/sites/wf/_api/web');
    await expect(client.addListItemByTitle('SupportRecord_Daily', { Title: 'X' })).rejects.toThrow(/Internal Boom/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
