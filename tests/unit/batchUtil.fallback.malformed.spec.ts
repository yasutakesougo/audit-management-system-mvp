import { describe, it, expect } from 'vitest';
import { parseBatchInsertResponse } from '../../src/features/audit/batchUtil';

function makeResponse(body: string): Response { return new Response(body, { status: 200 }); }

describe('batchUtil fallback parser (more malformed bodies)', () => {
  it('handles mixed LF-only endings and missing Content-ID lines', async () => {
    // Boundary tokens broken; rely on fallback heuristic using HTTP lines.
    const raw =
      '--batch_x\n' +
      'garbage\nHTTP/1.1 201 Created\nContent-Type: application/json\n\n{}\n' +
      'random\nHTTP/1.1 409 Conflict\nContent-Type: application/json\n\n{}\n' +
      'x\nHTTP/1.1 500 Internal Server Error\nContent-Type: application/json\n\n{}';
    const parsed = await parseBatchInsertResponse(makeResponse(raw));
    expect(parsed.total).toBe(3);
    expect(parsed.success + parsed.failed).toBe(3);
    // success counts 201 + 409(dup) treated as success
    expect(parsed.success).toBe(2);
    expect(parsed.duplicates).toBe(1);
    expect(parsed.failed).toBe(1);
  });

  it('ignores extra blank lines and odd casing for headers', async () => {
    const raw = [
      '--batch_y',
      '',
      '',
      'CONTENT-type: multipart/mixed',
      '',
      'HTTP/1.1 201 Created',
      '',
      '{}',
      'HTTP/1.1 201 CREATED',
      '',
      '{}',
      'HTTP/1.1 409 CONFLICT',
      '',
      '{}'
    ].join('\n');
    const parsed = await parseBatchInsertResponse(makeResponse(raw));
    expect(parsed.total).toBe(3);
    expect(parsed.success).toBe(3); // includes duplicate (409) as success
    expect(parsed.duplicates).toBe(1);
    expect(parsed.failed).toBe(0);
  });
});
