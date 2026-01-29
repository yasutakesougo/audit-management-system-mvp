import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    skipSharePoint: vi.fn(() => false),
    shouldSkipLogin: vi.fn(() => false),
  };
});

import { createSpClient } from '../../src/lib/spClient';

// We simulate list() flow used by useChecklistApi: underlying call is getListItemsByTitle -> spFetch
// Scenario: first 401 unauthorized -> token refresh -> success with empty value array

describe('checklist list 401 refresh flow', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  let acquireToken: any;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch' as any);
    acquireToken = vi.fn();
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('401 then refreshed token returns data', async () => {
    acquireToken
      .mockResolvedValueOnce('tokA')
      .mockResolvedValueOnce('tokB');

    fetchSpy
      .mockResolvedValueOnce(new Response('unauthorized', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: [{ Id: 1, Title: 'X', cr013_key: 'k', cr013_value: 'v', cr013_note: 'n' }] }), { status: 200 }));

    const client = createSpClient(acquireToken, 'https://contoso.sharepoint.com/sites/wf/_api/web');
    const res = await client.spFetch(`/lists/getbytitle('Compliance_Checklist')/items?$top=200`);
    const json = await res.json();
    expect(json.value.length).toBe(1);
    expect(acquireToken).toHaveBeenCalledTimes(2);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
