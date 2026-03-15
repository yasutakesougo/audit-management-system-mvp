import { describe, expect, it } from 'vitest';
import {
  classifyError,
  classifyErrorWithHint,
  type SafeError,
} from '@/lib/errors';

// ─── Helpers ─────────────────────────────────────────────────────────────

function safeError(overrides: Partial<SafeError> & { status?: number; statusCode?: number } = {}): SafeError & Record<string, unknown> {
  return { message: '', ...overrides };
}

// ─── classifyError ───────────────────────────────────────────────────────

describe('classifyError', () => {
  // --- Auth ---
  it('returns auth for status 401', () => {
    expect(classifyError(safeError({ status: 401 }))).toBe('auth');
  });

  it('returns auth for status 403', () => {
    expect(classifyError(safeError({ status: 403 }))).toBe('auth');
  });

  it('returns auth for statusCode 401', () => {
    expect(classifyError(safeError({ statusCode: 401 }))).toBe('auth');
  });

  it('returns auth for MSAL interaction_required', () => {
    expect(classifyError(safeError({ message: 'AADSTS65001: interaction_required' }))).toBe('auth');
  });

  it('returns auth for consent_required', () => {
    expect(classifyError(safeError({ message: 'consent_required: scope needed' }))).toBe('auth');
  });

  it('returns auth for login_required', () => {
    expect(classifyError(safeError({ message: 'login_required' }))).toBe('auth');
  });

  it('returns auth for "no signed-in account"', () => {
    expect(classifyError(safeError({ message: 'No signed-in account found' }))).toBe('auth');
  });

  it('returns auth for AADSTS70011 code', () => {
    expect(classifyError(safeError({ message: 'AADSTS70011: invalid scope' }))).toBe('auth');
  });

  it('returns auth for ".default scope can\'t be combined"', () => {
    expect(classifyError(safeError({ message: ".default scope can't be combined with other scopes" }))).toBe('auth');
  });

  it('returns auth for "unauthorized" keyword', () => {
    expect(classifyError(safeError({ message: 'Unauthorized access' }))).toBe('auth');
  });

  it('returns auth for "forbidden" keyword', () => {
    expect(classifyError(safeError({ message: 'Forbidden' }))).toBe('auth');
  });

  it('returns auth when code contains auth keyword', () => {
    expect(classifyError(safeError({ code: 'UNAUTHORIZED', message: 'request failed' }))).toBe('auth');
  });

  // --- Timeout ---
  it('returns timeout for "timeout" keyword', () => {
    expect(classifyError(safeError({ message: 'Request timeout' }))).toBe('timeout');
  });

  it('returns timeout for "timed out" keyword', () => {
    expect(classifyError(safeError({ message: 'Connection timed out' }))).toBe('timeout');
  });

  it('returns timeout for "deadline" keyword', () => {
    expect(classifyError(safeError({ message: 'Deadline exceeded' }))).toBe('timeout');
  });

  it('returns timeout for status 504', () => {
    expect(classifyError(safeError({ status: 504 }))).toBe('timeout');
  });

  // --- Network ---
  it('returns network for "failed to fetch"', () => {
    expect(classifyError(safeError({ message: 'Failed to fetch' }))).toBe('network');
  });

  it('returns network for "network error"', () => {
    expect(classifyError(safeError({ message: 'Network Error' }))).toBe('network');
  });

  it('returns network for "connectivity"', () => {
    expect(classifyError(safeError({ message: 'No connectivity available' }))).toBe('network');
  });

  it('returns network for 429 rate limit', () => {
    expect(classifyError(safeError({ message: 'HTTP 429 Too Many Requests' }))).toBe('network');
  });

  it('returns network for 503 service unavailable', () => {
    expect(classifyError(safeError({ message: '503 Service Unavailable' }))).toBe('network');
  });

  // --- Schema ---
  it('returns schema for "does not exist"', () => {
    expect(classifyError(safeError({ message: "Column 'Foo' does not exist" }))).toBe('schema');
  });

  it('returns schema for "property" keyword', () => {
    expect(classifyError(safeError({ message: 'Property not available on this object' }))).toBe('schema');
  });

  it('returns schema for "field" keyword', () => {
    expect(classifyError(safeError({ message: 'Field not recognized' }))).toBe('schema');
  });

  it('returns schema for "schema" keyword', () => {
    expect(classifyError(safeError({ message: 'Schema mismatch' }))).toBe('schema');
  });

  it('returns schema for "invalid" keyword', () => {
    expect(classifyError(safeError({ message: 'Invalid column name' }))).toBe('schema');
  });

  // --- Server ---
  it('returns server for status 500', () => {
    expect(classifyError(safeError({ status: 500 }))).toBe('server');
  });

  it('returns server for status 502', () => {
    expect(classifyError(safeError({ status: 502 }))).toBe('server');
  });

  // --- Unknown ---
  it('returns unknown for unrecognised error', () => {
    expect(classifyError(safeError({ message: 'Something completely unexpected' }))).toBe('unknown');
  });

  it('returns unknown for empty error', () => {
    expect(classifyError(safeError())).toBe('unknown');
  });

  // --- Priority: timeout before network (both match "timed out") ---
  it('prioritises timeout over network when message has timeout keywords', () => {
    expect(classifyError(safeError({ message: 'Request timed out due to network error' }))).toBe('timeout');
  });

  // --- Priority: auth over timeout when status is 401 with timeout message ---
  it('prioritises auth over timeout for status 401', () => {
    expect(classifyError(safeError({ status: 401, message: 'timeout during auth' }))).toBe('auth');
  });
});

// ─── classifyErrorWithHint ───────────────────────────────────────────────

describe('classifyErrorWithHint', () => {
  it('returns { kind, hint } for classified error', () => {
    const result = classifyErrorWithHint(safeError({ status: 401 }));
    expect(result.kind).toBe('auth');
    expect(typeof result.hint).toBe('string');
    expect(result.hint.length).toBeGreaterThan(0);
  });

  it('returns unknown with hint for null', () => {
    const result = classifyErrorWithHint(null);
    expect(result.kind).toBe('unknown');
    expect(result.hint).toContain('予期しないエラー');
  });

  it('returns unknown with hint for undefined', () => {
    const result = classifyErrorWithHint(undefined);
    expect(result.kind).toBe('unknown');
    expect(result.hint).toContain('予期しないエラー');
  });

  it('returns Japanese hint for each error kind', () => {
    const cases: Array<{ error: SafeError & Record<string, unknown>; expectedKind: string }> = [
      { error: safeError({ status: 401 }), expectedKind: 'auth' },
      { error: safeError({ message: 'Failed to fetch' }), expectedKind: 'network' },
      { error: safeError({ message: 'Request timeout' }), expectedKind: 'timeout' },
      { error: safeError({ message: 'Field not found' }), expectedKind: 'schema' },
      { error: safeError({ status: 500 }), expectedKind: 'server' },
      { error: safeError({ message: 'unknown thing' }), expectedKind: 'unknown' },
    ];

    for (const { error, expectedKind } of cases) {
      const result = classifyErrorWithHint(error);
      expect(result.kind).toBe(expectedKind);
      expect(result.hint.length).toBeGreaterThan(0);
    }
  });
});
