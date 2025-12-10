import { normalizeServiceType, SERVICE_TYPE_OPTIONS } from '@/sharepoint/serviceTypes';
import { describe, expect, it } from 'vitest';

describe('serviceTypes.normalizeServiceType', () => {
  it('returns exact matches for canonical values', () => {
    for (const value of SERVICE_TYPE_OPTIONS) {
      expect(normalizeServiceType(value)).toBe(value);
    }
  });

  it('trims whitespace and rejects unknown values', () => {
    expect(normalizeServiceType(' 送迎 ')).toBe('送迎');
    expect(normalizeServiceType('未知カテゴリ')).toBeNull();
    expect(normalizeServiceType('')).toBeNull();
    expect(normalizeServiceType(undefined)).toBeNull();
  });
});
