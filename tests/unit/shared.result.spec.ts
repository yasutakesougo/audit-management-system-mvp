import { describe, expect, test } from 'vitest';
import { isErr, isOk, result } from '@/shared/result';

describe('result', () => {
  test('ok and isOk guard work', () => {
    const a = result.ok(123);

    expect(isOk(a)).toBe(true);
    expect(isErr(a)).toBe(false);

    if (isOk(a)) {
      expect(a.value).toBe(123);
    }
  });

  test('err (conflict) and isErr guard work', () => {
    const b = result.conflict({ message: 'Version mismatch', etag: '"etag-123"' });

    expect(isOk(b)).toBe(false);
    expect(isErr(b)).toBe(true);

    if (isErr(b)) {
      expect(b.error.kind).toBe('conflict');
      expect(b.error.message).toBe('Version mismatch');
      expect(b.error.etag).toBe('"etag-123"');
    }
  });

  test('forbidden helper works', () => {
    const c = result.forbidden('Access denied');

    expect(isErr(c)).toBe(true);

    if (isErr(c)) {
      expect(c.error.kind).toBe('forbidden');
    }
  });

  test('notFound helper works', () => {
    const d = result.notFound('Item not found');

    expect(isErr(d)).toBe(true);

    if (isErr(d)) {
      expect(d.error.kind).toBe('notFound');
    }
  });

  test('validation helper works with field', () => {
    const e = result.validation('Invalid email', 'email');

    expect(isErr(e)).toBe(true);

    if (isErr(e)) {
      expect(e.error.kind).toBe('validation');
      expect(e.error.message).toBeTruthy();
    }
  });
});
