import { describe, expect, it } from 'vitest';
import { escapeODataString } from '@/lib/odata';

describe('escapeODataString', () => {
  it('doubles single quotes', () => {
    expect(escapeODataString("O'Brien")).toBe("O''Brien");
  });

  it('handles multiple single quotes', () => {
    expect(escapeODataString("it's a 'test'")).toBe("it''s a ''test''");
  });

  it('strips newlines and tabs', () => {
    expect(escapeODataString("line1\nline2\ttab\rreturn")).toBe("line1line2tabreturn");
  });

  it('handles percent-encoded single quotes', () => {
    expect(escapeODataString("abc%27def")).toBe("abc''def");
  });

  it('returns empty string for empty input', () => {
    expect(escapeODataString("")).toBe("");
  });

  it('passes through normal strings unchanged', () => {
    expect(escapeODataString("user-123")).toBe("user-123");
    expect(escapeODataString("2026-03-15")).toBe("2026-03-15");
  });
});
