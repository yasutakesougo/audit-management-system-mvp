import { describe, it, expect, vi } from 'vitest';
import { createSpClient } from '@/lib/spClient';
import { buildBatchInsertBody } from '@/features/audit/batchUtil';

vi.mock('@/lib/env', async () => {
  const actual = await vi.importActual<typeof import('@/lib/env')>('@/lib/env');
  return {
    ...actual,
    skipSharePoint: vi.fn(() => false),
    shouldSkipLogin: vi.fn(() => false),
  };
});

const multi = (boundary: string, blocks: Array<{ id: number; status: number }>) => {
  const cs = `changeset_${boundary}`;
  const lines: string[] = [];
  lines.push(`--batch_${boundary}`);
  lines.push(`Content-Type: multipart/mixed; boundary=${cs}`, '');

  blocks.forEach(b => {
    lines.push(`--${cs}`);
    lines.push('Content-Type: application/http');
    lines.push(`Content-ID: ${b.id}`, '');
    lines.push(`HTTP/1.1 ${b.status} ${b.status === 201 ? 'Created' : 'Error'}`, '');
    lines.push('{}', '');
  });

  lines.push(`--${cs}--`, `--batch_${boundary}--`, '');
  return lines.join('\r\n');
};

describe('$batch retry + parse', () => {
  it('503 -> retry then 200 success, mixed statuses returned', async () => {
    const boundary = 'b1';
    const okRes = new Response(
      multi(boundary, [
        { id: 1, status: 201 },
        { id: 2, status: 409 },
        { id: 3, status: 500 }
      ]),
      {
        status: 200,
        headers: { 'Content-Type': `multipart/mixed; boundary=batch_${boundary}` }
      }
    );

    const fetchSpy = vi
      .spyOn(global, 'fetch' as any)
      .mockResolvedValueOnce(new Response('svc down', { status: 503 }))
      .mockResolvedValueOnce(okRes);

    const acquire = vi.fn().mockResolvedValue('tok');
    const client = createSpClient(acquire, 'https://contoso.sharepoint.com/sites/wf/_api/web');

    const base = {
      ts: new Date().toISOString(),
      actor: 'actor1',
      action: 'CREATE',
      entity: 'Entity',
      entity_id: null,
      channel: 'UI' as const,
      after_json: null,
      entry_hash: 'hash'
    };
    const { body, boundary: b } = buildBatchInsertBody('Audit_Events', [
      { Title: 'A', ...base },
      { Title: 'B', ...base },
      { Title: 'C', ...base }
    ], '/sites/wf');

    const res = await client.postBatch(body, b);
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
