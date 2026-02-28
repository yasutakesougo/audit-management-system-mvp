import { WriteDisabledError } from '@/infra/sharepoint/repos/schedulesRepo';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifySchedulesError, shouldFallbackToReadOnly } from './errors';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('classifySchedulesError', () => {
  it('classifies WriteDisabledError as WRITE_DISABLED', () => {
    const error = new WriteDisabledError('createSchedule');
    const info = classifySchedulesError(error);

    expect(info.kind).toBe('WRITE_DISABLED');
    expect(info.title).toContain('閲覧専用');
    expect(info.message).toContain('作成・編集・削除は無効');
    expect(info.action?.label).toContain('管理者');
  });

  it('classifies HTTP 401 as AUTH_REQUIRED', () => {
    const error = { status: 401, message: 'Unauthorized' };
    const info = classifySchedulesError(error);

    expect(info.kind).toBe('AUTH_REQUIRED');
    expect(info.title).toContain('権限');
    expect(info.details?.[0]).toContain('401');
  });

  it('classifies HTTP 403 as AUTH_REQUIRED', () => {
    const error = { status: 403, message: 'Forbidden' };
    const info = classifySchedulesError(error);

    expect(info.kind).toBe('AUTH_REQUIRED');
    expect(info.details?.[0]).toContain('403');
  });

  it('classifies HTTP 404 as LIST_MISSING', () => {
    const error = { status: 404, message: 'Not Found' };
    const info = classifySchedulesError(error);

    expect(info.kind).toBe('LIST_MISSING');
    expect(info.title).toContain('見つかりません');
    expect(info.message).toContain('ScheduleEvents');
  });

  it('classifies HTTP 429 as THROTTLED', () => {
    const error = { status: 429, message: 'Too Many Requests' };
    const info = classifySchedulesError(error);

    expect(info.kind).toBe('THROTTLED');
    expect(info.title).toContain('混雑');
    expect(info.action?.onClick).toBeDefined();
  });

  it('classifies HTTP 503 as THROTTLED', () => {
    const error = { status: 503, message: 'Service Unavailable' };
    const info = classifySchedulesError(error);

    expect(info.kind).toBe('THROTTLED');
    expect(info.details?.[0]).toContain('503');
  });

  it('classifies "list-not-found" message as LIST_MISSING', () => {
    const error = new Error('SharePoint list-not-found');
    const info = classifySchedulesError(error);

    expect(info.kind).toBe('LIST_MISSING');
    expect(info.message).toContain('ScheduleEvents');
  });

  it('classifies unknown errors as UNKNOWN', () => {
    const error = new Error('Something went wrong');
    const info = classifySchedulesError(error);

    expect(info.kind).toBe('UNKNOWN');
    expect(info.title).toContain('エラー');
    expect(info.message).toBe('Something went wrong');
  });

  it('classifies offline state as NETWORK_ERROR', () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const info = classifySchedulesError(new Error('Any error'));

    expect(info.kind).toBe('NETWORK_ERROR');
    expect(info.title).toContain('ネットワークエラー');
    vi.unstubAllGlobals();
  });

  it('classifies "failed to fetch" as NETWORK_ERROR', () => {
    const error = new Error('Failed to fetch');
    const info = classifySchedulesError(error);

    expect(info.kind).toBe('NETWORK_ERROR');
    expect(info.title).toContain('ネットワークエラー');
  });
});

describe('shouldFallbackToReadOnly', () => {
  beforeEach(() => {
    // Ensure navigator.onLine is true — prevents leak from offline test above
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  });

  it('returns true for WRITE_DISABLED', () => {
    const error = new WriteDisabledError('createSchedule');
    expect(shouldFallbackToReadOnly(error)).toBe(true);
  });

  it('returns true for AUTH_REQUIRED', () => {
    const error = { status: 401 };
    expect(shouldFallbackToReadOnly(error)).toBe(true);
  });

  it('returns true for LIST_MISSING', () => {
    const error = { status: 404 };
    expect(shouldFallbackToReadOnly(error)).toBe(true);
  });

  it('returns false for THROTTLED (transient)', () => {
    const error = { status: 429 };
    expect(shouldFallbackToReadOnly(error)).toBe(false);
  });

  it('returns false for UNKNOWN (transient)', () => {
    const error = new Error('Random error');
    expect(shouldFallbackToReadOnly(error)).toBe(false);
  });
});
