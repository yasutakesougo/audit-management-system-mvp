import { normalizeUserId } from '@/lib/normalizeUserId';

describe('normalizeUserId', () => {
  it('strips hyphens', () => {
    expect(normalizeUserId('U-001')).toBe('U001');
  });

  it('uppercases lowercase input', () => {
    expect(normalizeUserId('u001')).toBe('U001');
    expect(normalizeUserId('u-001')).toBe('U001');
  });

  it('trims whitespace', () => {
    expect(normalizeUserId('  U-001 ')).toBe('U001');
  });

  it('strips all non-alphanumeric characters', () => {
    expect(normalizeUserId('U_001')).toBe('U001');
    expect(normalizeUserId('U.001')).toBe('U001');
    expect(normalizeUserId('U 001')).toBe('U001');
  });

  it('is idempotent', () => {
    const first = normalizeUserId('U-001');
    const second = normalizeUserId(first);
    expect(first).toBe(second);
  });

  it('handles numeric-only IDs', () => {
    expect(normalizeUserId('001')).toBe('001');
  });

  it('handles LOCAL-U format', () => {
    expect(normalizeUserId('LOCAL-U-0001')).toBe('LOCALU0001');
  });
});
