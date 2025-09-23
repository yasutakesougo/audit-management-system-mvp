import { describe, it, expect } from 'vitest';
import { parseBatchInsertResponse, ParsedBatchInsertResult } from '../../src/features/audit/batchUtil';

function makeResponse(body: string, ok = true): Response {
  return new Response(body, { status: ok ? 200 : 500 });
}

describe('batch parser fallback', () => {
  it('parses without boundary (mixed newlines) but with HTTP lines', async () => {
    const raw = [
      'Content-Id: 1',
      '',
      'HTTP/1.1 201 Created',
      'Content-Type: application/json',
      '',
      '{}',
      'Content-Id: 2',
      '',
      'HTTP/1.1 409 Conflict',
      '',
      'Content-Id: 3',
      '',
      'HTTP/1.1 500 Internal Server Error',
    ].join('\r\n');
    const res = await parseBatchInsertResponse(makeResponse('--batch_x\n' + raw));
    expect(res.total).toBe(3);
    expect(res.success).toBe(2); // 201 + 409 treated as success
    expect(res.failed).toBe(1);
  const statuses = res.errors.map((e: ParsedBatchInsertResult['errors'][number]) => e.status);
    expect(statuses).toContain(500);
  const ids = res.errors.map((e: ParsedBatchInsertResult['errors'][number]) => e.contentId).filter((x: number) => !isNaN(x));
    expect(ids.length).toBe(1);
  });

  it('finds Content-Id case-insensitively & within 6 lines', async () => {
    const raw = [
      'content-id: 9',
      '',
      '',
      'HTTP/1.1 503 Service Unavailable',
      '',
      'HTTP/1.1 201 Created',
    ].join('\n');
    const res = await parseBatchInsertResponse(makeResponse('--batch_z\n' + raw));
    expect(res.total).toBe(2);
    expect(res.errors[0].status).toBe(503);
    expect(res.errors[0].contentId).toBe(9); // first item 503 with id 9
  });
});
