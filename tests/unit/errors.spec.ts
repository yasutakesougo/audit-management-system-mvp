import {
    AuthRequiredError,
    SharePointBatchParseError,
    SharePointItemNotFoundError,
    SharePointMissingEtagError,
    toSafeError,
    type SafeError,
} from '@/lib/errors';
import { describe, expect, it } from 'vitest';

describe('errors: custom error classes', () => {
  it('AuthRequiredError sets name and default message', () => {
    const err = new AuthRequiredError();
    expect(err.name).toBe('AuthRequiredError');
    expect(err.message).toBe('AUTH_REQUIRED');
  });

  it('SharePoint errors expose explicit names', () => {
    expect(new SharePointItemNotFoundError().name).toBe('SharePointItemNotFoundError');
    expect(new SharePointMissingEtagError().name).toBe('SharePointMissingEtagError');
    expect(new SharePointBatchParseError().name).toBe('SharePointBatchParseError');
  });
});

describe('errors: toSafeError', () => {
  it('wraps Error instances and preserves code/name/cause', () => {
    const err = new SharePointMissingEtagError('missing');
    (err as { code?: string }).code = 'E_MISSING';
    const safe = toSafeError(err);
    expect(safe).toMatchObject({
      message: 'missing',
      code: 'E_MISSING',
      name: 'SharePointMissingEtagError',
      cause: err,
    });
  });

  it('returns message from plain object error-like payloads', () => {
    const payload = { message: 'plain failure', meta: { status: 400 } };
    const safe = toSafeError(payload);
    expect(safe.message).toBe('plain failure');
    expect(safe.cause).toBe(payload);
  });

  it('stringifies objects without message properties', () => {
    const payload = { foo: 'bar' };
    const safe = toSafeError(payload);
    expect(safe.message).toBe(JSON.stringify(payload));
  });

  it('handles circular objects by falling back to default string conversion', () => {
    const payload: { self?: unknown } = {};
    payload.self = payload;
    const safe = toSafeError(payload);
    expect(safe.message).toBe('[object Object]');
  });

  it('wraps string inputs directly', () => {
    const safe = toSafeError('boom');
    expect(safe).toEqual<SafeError>({ message: 'boom' });
  });

  it('stringifies non-object primitives', () => {
    const safe = toSafeError(null);
    expect(safe.message).toBe('null');
    const numberSafe = toSafeError(123);
    expect(numberSafe.message).toBe('123');
  });
});
