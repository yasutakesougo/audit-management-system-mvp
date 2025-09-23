import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSpClient } from '@/lib/spClient';

const ok = (body: any = {}) => new Response(JSON.stringify(body), { status: 200 });
const r = (s: number, body: any = {}) => new Response(JSON.stringify(body), { status: s });

describe('spClient retries & refresh', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let acquireToken: any;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch' as any);
    // per-test we will define token sequence explicitly
    acquireToken = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('401 -> token refresh -> success (single refresh)', async () => {
    // initial call returns token A, refresh returns token B (different triggers second fetch)
    acquireToken
      .mockResolvedValueOnce('tokA')
      .mockResolvedValueOnce('tokB');

    fetchSpy
      .mockResolvedValueOnce(r(401)) // first attempt fails auth
      .mockResolvedValueOnce(ok({ value: [] })); // second with refreshed token succeeds

    const client = createSpClient(acquireToken, 'https://contoso.sharepoint.com/sites/wf/_api/web');
    const res = await client.spFetch(`/lists/getbytitle('X')/items`);
    const data = await res.json();
    expect(data.value).toEqual([]);
    expect(acquireToken).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('429 -> retry once -> success', async () => {
    acquireToken.mockResolvedValue('tokA');
    fetchSpy
      .mockResolvedValueOnce(r(429, { message: 'throttle' }))
      .mockResolvedValueOnce(ok({ ok: true }));

    const client = createSpClient(acquireToken, 'https://contoso.sharepoint.com/sites/wf/_api/web');
    const res = await client.spFetch('/whatever');
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('503 -> exhaust retries -> throws', async () => {
    acquireToken.mockResolvedValue('tokA');
    fetchSpy.mockResolvedValue(r(503, { message: 'svc down' }));

    const client = createSpClient(acquireToken, 'https://contoso.sharepoint.com/sites/wf/_api/web');
    await expect(client.spFetch('/x')).rejects.toThrow();
    // default maxAttempts = 4 -> initial + 3 retries = 4 fetch calls
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });
});
