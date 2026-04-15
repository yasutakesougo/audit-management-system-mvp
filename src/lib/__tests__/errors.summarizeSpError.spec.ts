import { describe, it, expect } from 'vitest';
import { summarizeSpError } from '../errors';

describe('summarizeSpError', () => {
  it('extracts status and message from raiseHttpError-style errors', () => {
    const err: Error & { status?: number } = new Error('Forbidden');
    err.status = 403;

    const summary = summarizeSpError(err);
    expect(summary.httpStatus).toBe(403);
    expect(summary.message).toBe('Forbidden');
  });

  it('returns undefined httpStatus for plain Error', () => {
    const summary = summarizeSpError(new Error('boom'));
    expect(summary.httpStatus).toBeUndefined();
    expect(summary.message).toBe('boom');
  });

  it('extracts nested response.status', () => {
    const err = { response: { status: 401 }, message: 'Unauthorized' };
    const summary = summarizeSpError(err);
    expect(summary.httpStatus).toBe(401);
    expect(summary.message).toBe('Unauthorized');
  });

  it('falls back to String(error) for non-object inputs', () => {
    expect(summarizeSpError('oops').message).toBe('oops');
    expect(summarizeSpError(null).message).toBe('null');
  });
});
