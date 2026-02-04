import { describe, expect, it } from 'vitest';

import { buildAuthDiagCopyText } from '@/lib/authDiag';

describe('buildAuthDiagCopyText', () => {
  it('builds copy text with defaults', () => {
    const text = buildAuthDiagCopyText({
      summary: {
        code: 'TOKEN_ACQUIRE_PENDING',
        message: 'pending',
        detail: { a: 1 },
      },
      corrId: 'AUTH-TEST',
    });

    expect(text).toContain('ReasonCode: TOKEN_ACQUIRE_PENDING');
    expect(text).toContain('CorrelationId: AUTH-TEST');
    expect(text).toContain('Message: pending');
    expect(text).toContain('Timestamp:');
    expect(text).toContain('URL:');
    expect(text).toContain('UserAgent:');
    expect(text).toContain('"a": 1');
  });

  it('uses provided metadata', () => {
    const text = buildAuthDiagCopyText({
      summary: {
        code: 'LIST_NOT_FOUND',
        message: 'blocked',
        detail: { b: true },
      },
      corrId: 'AUTH-XYZ',
      url: 'https://example.test/path',
      userAgent: 'UA',
      timestamp: '2026-02-01T00:00:00.000Z',
    });

    expect(text).toContain('Timestamp: 2026-02-01T00:00:00.000Z');
    expect(text).toContain('URL: https://example.test/path');
    expect(text).toContain('UserAgent: UA');
    expect(text).toContain('"b": true');
  });
});
