import { describe, it, expect } from 'vitest';
import { readSharePointText } from '../readSharePointText';

describe('readSharePointText', () => {
  it('returns plain string as-is', () => {
    expect(readSharePointText('plain-string')).toBe('plain-string');
  });

  it('returns number as string', () => {
    expect(readSharePointText(42)).toBe('42');
    expect(readSharePointText(0)).toBe('0');
  });

  it('extracts Title from SP Lookup object', () => {
    expect(readSharePointText({ Title: 'Alice', Id: 7 })).toBe('Alice');
  });

  it('extracts LookupValue when Title is absent', () => {
    expect(readSharePointText({ LookupValue: 'Bob', Id: 3 })).toBe('Bob');
  });

  it('falls back to Id when Title and LookupValue are absent', () => {
    expect(readSharePointText({ Id: 99 })).toBe('99');
  });

  it('returns empty string for null', () => {
    expect(readSharePointText(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(readSharePointText(undefined)).toBe('');
  });

  it('returns empty string for empty object', () => {
    expect(readSharePointText({})).toBe('');
  });

  it('returns empty string for object with non-scalar values', () => {
    expect(readSharePointText({ Title: { nested: true } })).toBe('');
  });

  it('handles SP Person object with EMail and Title', () => {
    expect(readSharePointText({ Title: 'U004', EMail: 'u004@example.com', Id: 4 })).toBe('U004');
  });

  it('handles numeric Title (SP sometimes returns number in Title)', () => {
    expect(readSharePointText({ Title: 3, Id: 3 })).toBe('3');
  });

  it('returns empty string for empty string input', () => {
    expect(readSharePointText('')).toBe('');
  });
});
