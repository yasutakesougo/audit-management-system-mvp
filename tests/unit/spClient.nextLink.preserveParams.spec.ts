import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSpClient } from '../../src/lib/spClient';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    skipSharePoint: vi.fn(() => false),
    shouldSkipLogin: vi.fn(() => false),
  };
});

describe('spClient listItems nextLink', () => {
  const BASE_URL = 'https://contoso.sharepoint.com/sites/Audit/_api/web';

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preserves select/expand parameters across nextLink paging', async () => {
    const firstPage = {
      value: [{ Id: 1 }],
      '@odata.nextLink': `${BASE_URL}/lists/getbytitle('L')/items?$select=Id,Title&$expand=Author&$skiptoken=abc`,
    };
    const secondPage = { value: [{ Id: 2 }] };
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify(firstPage), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(secondPage), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );

    const client = createSpClient(async () => 'token', BASE_URL);
    const rows = await client.listItems('L', {
      select: ['Id', 'Title'],
      expand: 'Author',
      top: 1,
    });

    const ids = rows.map((row) => (row as { Id: number }).Id);
    expect(ids).toEqual([1, 2]);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const secondUrl = fetchSpy.mock.calls[1]?.[0] as string;
    expect(secondUrl).toContain('$select=Id,Title');
    expect(secondUrl).toContain('$expand=Author');
    expect(secondUrl).toContain('$skiptoken=abc');
  });
});
