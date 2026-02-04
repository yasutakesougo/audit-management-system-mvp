import { describe, it, expect } from 'vitest';
import { normalizeHttpsUrl } from '@/env/url';

describe('normalizeHttpsUrl', () => {
  it('leaves https URLs unchanged', () => {
    expect(normalizeHttpsUrl('https://example.com')).toBe('https://example.com');
  });

  it('leaves localhost URLs unchanged (CI/E2E protection)', () => {
    expect(normalizeHttpsUrl('http://localhost:5173')).toBe('http://localhost:5173');
    expect(normalizeHttpsUrl('http://127.0.0.1:5173')).toBe('http://127.0.0.1:5173');
  });

  it('converts http to https for production URLs', () => {
    expect(normalizeHttpsUrl('http://example.com')).toBe('https://example.com');
    expect(normalizeHttpsUrl('http://login.microsoftonline.com')).toBe(
      'https://login.microsoftonline.com'
    );
  });

  it('returns empty string for empty input', () => {
    expect(normalizeHttpsUrl('')).toBe('');
  });
});
