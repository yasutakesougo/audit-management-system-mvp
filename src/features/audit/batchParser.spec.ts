import { describe, expect, it } from 'vitest';
import { parseBatchInsertResponse } from './batchUtil';

// More flexible type for mock status
type MockStatus =
  | number
  | { status: number; text?: string };

// Helper to build a mock multipart batch response body
function buildMockBatchResponse(statuses: MockStatus[]) {
  const batchBoundary = 'batch_mock123';
  const changesetBoundary = 'changeset_mock456';
  const parts = statuses.map((s, i) => {
    const status = typeof s === 'number' ? s : s.status;
    const text = typeof s === 'number' ? undefined : s.text;
    return [
      `--${changesetBoundary}`,
      'Content-Type: application/http',
      'Content-Transfer-Encoding: binary',
      `Content-ID: ${i + 1}`,
      '',
      `HTTP/1.1 ${status} ${text || (status === 201 ? 'Created' : 'Bad Request')}`,
      'Content-Type: application/json;odata=nometadata',
      '',
      status === 201 ? '{"d":{"id":123}}' : '{"error":"bad"}',
      ''
    ].join('\r\n');
  }).join('\r\n');

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
    const { body, batchBoundary } = buildMockBatchResponse([201, 201]);
    const res = new Response(body, { headers: { 'Content-Type': `multipart/mixed; boundary=${batchBoundary}` } });
    const parsed = await parseBatchInsertResponse(res);
    expect(parsed.total).toBe(2);
    expect(parsed.success).toBe(2);
    expect(parsed.failed).toBe(0);
    expect(parsed.errors).toHaveLength(0);
  });

  it('parses partial failure', async () => {
    const { body, batchBoundary } = buildMockBatchResponse([
      201,
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
      201,
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
      201,
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

  it('handles non-multipart response gracefully', async () => {
    const body = '{"value":"not multipart"}';
    const res = new Response(body, {
      headers: { 'Content-Type': 'application/json' },
    });

    const parsed = await parseBatchInsertResponse(res);

    // No batch boundary found -> fallback to zero results
    expect(parsed.total).toBe(0);
    expect(parsed.success).toBe(0);
    expect(parsed.failed).toBe(0);
    expect(parsed.errors).toEqual([]);
    expect(parsed.duplicates).toBeUndefined();
    expect(parsed.categories).toBeUndefined();
  });

  it('handles empty batch body as zero results', async () => {
    const res = new Response('', {
      headers: { 'Content-Type': 'multipart/mixed; boundary=batch_mock123' },
    });

    const parsed = await parseBatchInsertResponse(res);

    expect(parsed.total).toBe(0);
    expect(parsed.success).toBe(0);
    expect(parsed.failed).toBe(0);
    expect(parsed.errors).toEqual([]);
    expect(parsed.duplicates).toBeUndefined();
    expect(parsed.categories).toBeUndefined();
  });

  it('categorizes throttle and client errors correctly', async () => {
    const { body, batchBoundary } = buildMockBatchResponse([
      { status: 429, text: 'Too Many Requests' },
      { status: 404, text: 'Not Found' },
      { status: 401, text: 'Unauthorized' },
      { status: 403, text: 'Forbidden' },
      { status: 422, text: 'Unprocessable Entity' }, // should be 'other'
    ]);
    const res = new Response(body, {
      headers: { 'Content-Type': `multipart/mixed; boundary=${batchBoundary}` },
    });

    const parsed = await parseBatchInsertResponse(res);

    expect(parsed.total).toBe(5);
    expect(parsed.success).toBe(0);
    expect(parsed.failed).toBe(5);
    expect(parsed.categories?.throttle).toBe(1);
    expect(parsed.categories?.not_found).toBe(1);
    expect(parsed.categories?.auth).toBe(2); // 401 + 403
    expect(parsed.categories?.other).toBe(1); // 422
    expect(parsed.errors).toHaveLength(5);
  });

  it('triggers fallback parser for malformed batch and increments metrics', async () => {
    // Clear the fallback count before test
    if (typeof window !== 'undefined') {
      window.__AUDIT_BATCH_METRICS__ = {
        total: 0, success: 0, duplicates: 0, newItems: 0, failed: 0,
        retryMax: 0, categories: {}, durationMs: 0, timestamp: '',
        parserFallbackCount: 0
      };
    }

    // Create a malformed batch response that has HTTP lines but no proper changeset structure
    const malformedBody = [
      '--batch_mock123',
      'Content-Type: multipart/mixed; boundary=changeset_mock456',
      '',
      'Some malformed content',
      'Content-ID: 1',
      'HTTP/1.1 201 Created',
      '{"d":{"id":123}}',
      '',
      'Content-ID: 2',
      'HTTP/1.1 400 Bad Request',
      '{"error":"validation failed"}',
      '--batch_mock123--'
    ].join('\r\n');

    const res = new Response(malformedBody, {
      headers: { 'Content-Type': 'multipart/mixed; boundary=batch_mock123' },
    });

    const parsed = await parseBatchInsertResponse(res);

    // Should fallback to raw parsing
    expect(parsed.total).toBe(2);
    expect(parsed.success).toBe(1); // 201
    expect(parsed.failed).toBe(1); // 400
    expect(parsed.categories?.bad_request).toBe(1);

    // Check that fallback count was incremented
    if (typeof window !== 'undefined') {
      expect(window.__AUDIT_BATCH_METRICS__?.parserFallbackCount).toBe(1);
    }
  });

  it('handles Content-ID as string in fallback parser', async () => {
    // Clear the fallback count before test
    if (typeof window !== 'undefined') {
      window.__AUDIT_BATCH_METRICS__ = {
        total: 0, success: 0, duplicates: 0, newItems: 0, failed: 0,
        retryMax: 0, categories: {}, durationMs: 0, timestamp: '',
        parserFallbackCount: 0
      };
    }

    // Create a response that will trigger fallback with string Content-IDs
    const malformedBody = [
      '--batch_mock123',
      'Content-Type: multipart/mixed; boundary=changeset_mock456',
      '',
      'Some malformed content',
      'Content-ID: X1',  // String Content-ID
      'HTTP/1.1 201 Created',
      '{"d":{"id":123}}',
      '',
      'Content-ID: X2',
      'HTTP/1.1 400 Bad Request',
      '{"error":"validation failed"}',
      '--batch_mock123--'
    ].join('\r\n');

    const res = new Response(malformedBody, {
      headers: { 'Content-Type': 'multipart/mixed; boundary=batch_mock123' },
    });

    const parsed = await parseBatchInsertResponse(res);

    // Should handle string Content-IDs gracefully
    expect(parsed.total).toBe(2);
    expect(parsed.success).toBe(1);
    expect(parsed.failed).toBe(1);

    // Check that errors have proper structure even with string Content-IDs
    expect(parsed.errors).toHaveLength(1);
    expect(parsed.errors[0].status).toBe(400);
    expect(Number.isNaN(parsed.errors[0].contentId)).toBe(true); // X2 -> NaN
  });
});
