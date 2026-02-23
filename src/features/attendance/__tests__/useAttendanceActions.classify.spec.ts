import { describe, expect, it } from 'vitest';
import {
  classifyAttendanceError,
  isAttendanceError,
} from '../hooks/useAttendanceActions';

describe('classifyAttendanceError', () => {
  it('returns CONFLICT for status 409/412', () => {
    expect(classifyAttendanceError({ status: 409 }).code).toBe('CONFLICT');
    expect(classifyAttendanceError({ response: { status: 412 } }).code).toBe('CONFLICT');
  });

  it('returns THROTTLED for status 429/503', () => {
    expect(classifyAttendanceError({ status: 429 }).code).toBe('THROTTLED');
    expect(classifyAttendanceError({ cause: { status: 503 } }).code).toBe('THROTTLED');
  });

  it('returns NETWORK for network-like fetch error', () => {
    const networkError = new TypeError('Failed to fetch');
    expect(classifyAttendanceError(networkError).code).toBe('NETWORK');
  });

  it('returns UNKNOWN when no known status or network signature exists', () => {
    expect(classifyAttendanceError({ message: 'unexpected failure' }).code).toBe('UNKNOWN');
    expect(classifyAttendanceError('plain-string').code).toBe('UNKNOWN');
  });
});

describe('isAttendanceError', () => {
  it('detects classified attendance error objects', () => {
    const classified = classifyAttendanceError({ status: 409 });
    expect(isAttendanceError(classified)).toBe(true);
  });

  it('rejects non-classified objects', () => {
    expect(isAttendanceError({ code: 409 })).toBe(false);
    expect(isAttendanceError(null)).toBe(false);
    expect(isAttendanceError(undefined)).toBe(false);
  });
});
