import { describe, expect, it, vi } from 'vitest';
import { classifySpSyncError } from './classifySpSyncError';

describe('classifySpSyncError', () => {
  it('classifies 401/403 and MSAL codes as auth error', () => {
    const err401 = { status: 401, message: 'Unauthorized' };
    expect(classifySpSyncError(err401)).toEqual({
      errorKind: 'auth',
      hint: expect.stringContaining('認証'),
    });

    const errMsal = { message: 'interaction_required' };
    expect(classifySpSyncError(errMsal)).toEqual({
      errorKind: 'auth',
      hint: expect.stringContaining('ログイン'),
    });
  });

  it('classifies network connection issues as network error', () => {
    const errNetwork = { message: 'Failed to fetch' };
    expect(classifySpSyncError(errNetwork)).toEqual({
      errorKind: 'network',
      hint: expect.stringContaining('ネットワーク'),
    });

    // Mock navigator.onLine
    const spy = vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    expect(classifySpSyncError({ message: 'Anything' })).toEqual({
      errorKind: 'network',
      hint: expect.stringContaining('接続'),
    });
    spy.mockRestore();
  });

  it('classifies 5xx as server error', () => {
    const err500 = { statusCode: 500, message: 'Server Error' };
    expect(classifySpSyncError(err500)).toEqual({
      errorKind: 'server',
      hint: expect.stringContaining('サーバー'),
    });
  });

  it('classifies timeout as timeout error', () => {
    const errTimeout = { message: 'The request timed out' };
    expect(classifySpSyncError(errTimeout)).toEqual({
      errorKind: 'timeout',
      hint: expect.stringContaining('タイムアウト'),
    });
  });

  it('defaults to unknown for unrecognized errors', () => {
    expect(classifySpSyncError({ message: 'Random' })).toEqual({
      errorKind: 'unknown',
      hint: expect.stringContaining('予期しない'),
    });
  });
});
