import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    skipSharePoint: vi.fn(() => false),
    shouldSkipLogin: vi.fn(() => false),
  };
});

import { createSpClient } from '@/lib/spClient';

describe('spClient batch parsing', () => {
  const BASE_URL = 'https://contoso.sharepoint.com/sites/Audit/_api/web';

  const multipart = (parts: Array<{ status: number; body?: unknown }>) => {
    const boundary = 'batch_foo';
    const segments = parts
      .map((part) => {
        const statusText = part.status >= 200 && part.status < 300 ? 'OK' : 'Error';
        const body = part.body === undefined ? '' : JSON.stringify(part.body);
        return [
          `--${boundary}`,
          'Content-Type: application/http',
          'Content-Transfer-Encoding: binary',
          '',
          `HTTP/1.1 ${part.status} ${statusText}`,
          'Content-Type: application/json',
          '',
          body,
          '',
        ].join('\r\n');
      })
      .join('');
    const payload = `${segments}--${boundary}--\r\n`;
    return new Response(payload, {
      status: 200,
      headers: { 'Content-Type': `multipart/mixed; boundary=${boundary}` },
    });
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns SharePointBatchResult entries with per-operation status', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      multipart([
        { status: 201, body: { Id: 10 } },
        { status: 200, body: { ok: true } },
        { status: 404, body: { message: 'NotFound' } },
      ])
    );

    const client = createSpClient(async () => 'token', BASE_URL);

    const results = await client.batch([
      { kind: 'create', list: 'Users', body: { Title: 'A' } },
      { kind: 'update', list: 'Users', id: 2, body: { Title: 'B' }, etag: '"1"' },
      { kind: 'delete', list: 'Users', id: 3 },
    ]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ ok: true, status: 201 });
    expect(results[1]).toMatchObject({ ok: true, status: 200 });
    expect(results[2]).toMatchObject({ ok: false, status: 404 });
    expect(results[2]?.data).toMatchObject({ message: 'NotFound' });
  });
});
