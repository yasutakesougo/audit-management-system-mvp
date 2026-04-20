import { describe, expect, it } from 'vitest';
import { classifyCreateError } from '../classifyCreateError';

type TestError = {
  status?: number;
  message: string;
  headers?: Record<string, string>;
};

function makeErr(status: number | undefined, message: string, headers?: Record<string, string>): TestError {
  return { status, message, headers };
}

describe('classifyCreateError', () => {
  it.each([
    ['401 -> auth', makeErr(401, 'Unauthorized'), 'auth'],
    ['403 -> auth', makeErr(403, 'Forbidden'), 'auth'],
    ['429 -> throttle', makeErr(429, 'Too many requests'), 'throttle'],
    ['Retry-After header -> throttle', makeErr(400, 'any failure', { 'Retry-After': '30' }), 'throttle'],
    ['duplicate text -> duplicate', makeErr(400, 'duplicate value found'), 'duplicate'],
    ['412 + duplicate -> duplicate', makeErr(412, 'duplicate value found'), 'duplicate'],
    ['missing field -> drift', makeErr(400, "Column 'FooBar' does not exist on list"), 'drift'],
    ['internal name drift -> drift', makeErr(400, 'invalid internal name for field'), 'drift'],
    ['unmatched -> unknown', makeErr(500, 'unexpected server error'), 'unknown'],
  ])('%s', (_label, input, expected) => {
    expect(classifyCreateError(input).reason).toBe(expected);
  });

  it('prioritizes throttle over duplicate when both match', () => {
    const err = makeErr(429, 'duplicate value found', { 'Retry-After': '15' });
    const classified = classifyCreateError(err);
    expect(classified.reason).toBe('throttle');
    expect(classified.retryAfterSeconds).toBe(15);
  });

  it('prioritizes auth over duplicate when both match', () => {
    const err = makeErr(403, 'duplicate value found');
    const classified = classifyCreateError(err);
    expect(classified.reason).toBe('auth');
  });
});
