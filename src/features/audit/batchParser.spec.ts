import { describe, it, expect } from 'vitest';
import { parseBatchInsertResponse } from './batchUtil';

// Helper to build a mock multipart batch response body
function buildMockBatchResponse(statuses: { status: number; text?: string }[]) {
  const batchBoundary = 'batch_mock123';
  const changesetBoundary = 'changeset_mock456';
  const parts = statuses.map((s, i) => [
    `--${changesetBoundary}`,
    'Content-Type: application/http',
    'Content-Transfer-Encoding: binary',
    `Content-ID: ${i + 1}`,
    '',
    `HTTP/1.1 ${s.status} ${s.text || (s.status === 201 ? 'Created' : 'Bad Request')}`,
    'Content-Type: application/json;odata=nometadata',
    '',
    s.status === 201 ? '{"d":{"id":123}}' : '{"error":"bad"}',
    ''
  ].join('\r\n')).join('\r\n');

  const body = [
    `--${batchBoundary}`,
    `Content-Type: multipart/mixed; boundary=${changesetBoundary}`,
    '',
    parts,
    `--${changesetBoundary}--`,
    `--${batchBoundary}--`,
    ''
  ].join('\r\n');
  return { body, batchBoundary };
}

describe('parseBatchInsertResponse', () => {
  it('parses full success', async () => {
    const { body, batchBoundary } = buildMockBatchResponse([
      { status: 201 },
      { status: 201 }
    ]);
    const res = new Response(body, { headers: { 'Content-Type': `multipart/mixed; boundary=${batchBoundary}` } });
    const parsed = await parseBatchInsertResponse(res);
    expect(parsed.total).toBe(2);
    expect(parsed.success).toBe(2);
    expect(parsed.failed).toBe(0);
    expect(parsed.errors).toHaveLength(0);
  });

  it('parses partial failure', async () => {
    const { body, batchBoundary } = buildMockBatchResponse([
      { status: 201 },
      { status: 400, text: 'Bad Request' }
    ]);
    const res = new Response(body, { headers: { 'Content-Type': `multipart/mixed; boundary=${batchBoundary}` } });
    const parsed = await parseBatchInsertResponse(res);
    expect(parsed.total).toBe(2);
    expect(parsed.success).toBe(1);
    expect(parsed.failed).toBe(1);
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors?.[0].contentId).toBe(2);
    expect(parsed.errors?.[0].status).toBe(400);
  });

  it('treats 409 duplicates as success', async () => {
    const { body, batchBoundary } = buildMockBatchResponse([
      { status: 201 },
      { status: 409, text: 'Conflict' }
    ]);
    const res = new Response(body, { headers: { 'Content-Type': `multipart/mixed; boundary=${batchBoundary}` } });
    const parsed = await parseBatchInsertResponse(res);
    expect(parsed.total).toBe(2);
    // 201 + 409 counted as success
    expect(parsed.success).toBe(2);
    expect(parsed.failed).toBe(0);
    expect(parsed.duplicates).toBe(1);
    expect(parsed.errors).toHaveLength(0);
  });

  it('parses mixed statuses with categories', async () => {
    const { body, batchBoundary } = buildMockBatchResponse([
      { status: 201 },
      { status: 409, text: 'Conflict' },
      { status: 400, text: 'Bad Request' },
      { status: 503, text: 'Server Unavailable' }
    ]);
    const res = new Response(body, { headers: { 'Content-Type': `multipart/mixed; boundary=${batchBoundary}` } });
    const parsed = await parseBatchInsertResponse(res);
    expect(parsed.total).toBe(4);
    expect(parsed.success).toBe(2); // 201 + 409
    expect(parsed.failed).toBe(2);
    expect(parsed.categories?.bad_request).toBe(1);
    expect(parsed.categories?.server).toBe(1);
  });
});
