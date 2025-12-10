import { describe, expect, it } from 'vitest';
import { cn } from '../cn';

describe('cn utility', () => {
  it('should combine basic strings', () => {
    expect(cn('btn', 'primary')).toBe('btn primary');
  });

  it('should handle falsy values', () => {
    expect(cn('btn', null, 'primary', undefined, false)).toBe('btn primary');
  });

  it('should handle number 0 correctly (exclude it)', () => {
    expect(cn('btn', 0, 'primary')).toBe('btn primary');
  });

  it('should handle other numbers', () => {
    expect(cn('btn', 42, 'primary')).toBe('btn 42 primary');
  });

  it('should handle conditional objects', () => {
    expect(cn('btn', {
      'btn-primary': true,
      'btn-disabled': false,
      'btn-large': null
    })).toBe('btn btn-primary');
  });

  it('should handle nested arrays', () => {
    expect(cn(['btn', { primary: true }], 'lg')).toBe('btn primary lg');
  });

  it('should remove duplicates', () => {
    expect(cn('btn', 'btn', 'primary')).toBe('btn primary');
  });

  it('should trim whitespace in strings', () => {
    expect(cn('  btn  ', 'primary')).toBe('btn primary');
  });

  it('should handle object keys with whitespace', () => {
    expect(cn({ '  spaced-class  ': true })).toBe('spaced-class');
  });

  it('should handle complex Tailwind usage', () => {
    const getVariant = (): 'primary' | 'secondary' => 'primary';
    const variant = getVariant();
    const disabled = false;

    const result = cn(
      'px-4 py-2 rounded',
      variant === 'primary' && 'bg-blue-500 text-white',
      variant === 'secondary' && 'bg-gray-200 text-gray-900',
      { 'opacity-50': disabled }
    );

    expect(result).toBe('px-4 py-2 rounded bg-blue-500 text-white');
  });
});