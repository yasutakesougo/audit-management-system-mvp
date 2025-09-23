import { describe, it, expect } from 'vitest';
import { parseBatchInsertResponse } from '../../src/features/audit/batchUtil';

// This case aims to hit the condition where strict parser finds <=1 part but httpCount > total
// so that fallback parser is invoked (already covered partially, but we ensure single HTTP line triggers)

describe('batch parser single HTTP line fallback trigger', () => {
  it('fallback activates when only one HTTP line and boundary mismatch', async () => {
    const raw = [
      '--batch_123',
      'Content-Type: multipart/mixed; boundary=changeset_123',
      '',
      // Intentionally malformed / missing proper changeset separator formatting to trick strict parser
      'HTTP/1.1 500 Internal Server Error',
      'Content-Id: 5',
      '',
      '{"error":"x"}',
      '--batch_123--'
    ].join('\r\n');
    const res = new Response(raw, { status: 200 });
    const parsed = await parseBatchInsertResponse(res);
    // total should come from fallback parse (1 item failed)
    expect(parsed.total).toBe(1);
    expect(parsed.failed).toBe(1);
    expect(parsed.success).toBe(0);
    expect(parsed.errors.length).toBe(1);
  });
});
