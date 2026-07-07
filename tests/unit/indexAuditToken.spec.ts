import { describe, expect, it } from 'vitest';
import { normalizeSharePointBearerToken } from '../../scripts/ops/indexAuditToken';

describe('normalizeSharePointBearerToken', () => {
  it('removes surrounding line breaks and whitespace', () => {
    expect(normalizeSharePointBearerToken('abc.def.ghi\n')).toBe('abc.def.ghi');
    expect(normalizeSharePointBearerToken('\r\nabc.def.ghi\r\n')).toBe('abc.def.ghi');
  });

  it('removes folded whitespace inside the token', () => {
    expect(normalizeSharePointBearerToken('abc.\ndef.\nghi')).toBe('abc.def.ghi');
  });

  it('removes a bearer prefix before the script adds Authorization', () => {
    expect(normalizeSharePointBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('returns null for blank tokens', () => {
    expect(normalizeSharePointBearerToken(' \r\n\t ')).toBeNull();
    expect(normalizeSharePointBearerToken(undefined)).toBeNull();
  });
});
