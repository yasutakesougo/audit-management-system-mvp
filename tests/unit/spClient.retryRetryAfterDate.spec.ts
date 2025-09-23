import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSpClient } from '../../src/lib/spClient';

// Covers Retry-After header path when value is an HTTP-date (not numeric seconds)

describe('spClient retry with HTTP-date Retry-After header', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let acquireToken: any;
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch' as any);
    acquireToken = vi.fn().mockResolvedValue('tok');
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('parses HTTP-date Retry-After and retries', async () => {
    const future = new Date(Date.now() + 50).toUTCString();
    fetchSpy
      .mockResolvedValueOnce(new Response('throttle', { status: 429, headers: { 'Retry-After': future } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const client = createSpClient(acquireToken, 'https://contoso.sharepoint.com/sites/wf/_api/web');
    const res = await client.spFetch('/lists/getbytitle(\'X\')/items');
    const j = await res.json();
    expect(j.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
