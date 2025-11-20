import { cn } from '@/utils/cn';
import { describe, expect, it } from 'vitest';

describe('cn utility', () => {
  it('flattens nested arrays and objects while deduplicating values', () => {
  const nested = ['bar', ['baz', '', ['foo']]] as unknown as Parameters<typeof cn>[0];
  const flags = { qux: true, zap: false, ' spaced ': true } as unknown as Parameters<typeof cn>[0];
  const result = cn('foo', nested, flags, null, undefined);
    expect(result).toBe('foo bar baz qux spaced');
  });

  it('supports numeric values and ignores falsy entries', () => {
  const nestedNumbers = ['two', null, ['three', 0]] as unknown as Parameters<typeof cn>[0];
  const toggles = { zero: true, one: false, two: true } as unknown as Parameters<typeof cn>[0];
    const result = cn(0, 1, false, toggles, nestedNumbers);
    expect(result).toBe('1 zero two three');
  });
});
