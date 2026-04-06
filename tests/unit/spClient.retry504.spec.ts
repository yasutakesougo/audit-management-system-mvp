import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    skipSharePoint: vi.fn(() => false),
    shouldSkipLogin: vi.fn(() => false),
  };
});

import { createSpClient } from '@/lib/spClient';

const baseUrl = 'https://contoso.sharepoint.com/sites/wf/_api/web';

describe('spClient retry for 504 Gateway Timeout', () => {
  let fetchSpy: Mock;
  let acquireToken: Mock<() => Promise<string>>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch') as unknown as Mock;
    acquireToken = vi.fn().mockResolvedValue('token1');
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('retries once on 504 then succeeds', async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response('', { status: 504 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const sp = createSpClient(acquireToken, baseUrl);
    const res = await sp.spFetch('/lists/getbytitle(\'X\')/items');
    const json = await res.json();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(json.ok).toBe(true);
  });
});
