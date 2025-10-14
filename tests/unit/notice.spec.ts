import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const envMock = vi.hoisted(() => ({
  allowWriteFallback: vi.fn(),
  isDemoModeEnabled: vi.fn(),
}));

vi.mock('@/lib/env', () => envMock);

const { allowWriteFallback, isDemoModeEnabled } = envMock;

import {
  getRegisteredNotifier,
  notify,
  registerNotifier,
  showDemoWriteDisabled,
  withUserMessage,
} from '@/lib/notice';

describe('withUserMessage', () => {
  beforeEach(() => {
    allowWriteFallback.mockReset();
    isDemoModeEnabled.mockReset();
    registerNotifier(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    registerNotifier(null);
  });

  it('uses specific network message and preserves original text when error matches timeout rule', () => {
    const timeoutError = { message: ' Request timeout  ', code: 'Timeout' };

    const noticed = withUserMessage(timeoutError, 'ignored');

    expect(noticed.userMessage).toBe('ネットワークの状態を確認して、再度お試しください。');
    expect(noticed.message).toBe('Request timeout');
  });

  it('uses auth specific message when error code indicates forbidden', () => {
    const authError = { message: '', code: '403' };

    const noticed = withUserMessage(authError, 'ignored');

    expect(noticed.userMessage).toBe('再認証が必要です。サインインし直してください。');
    expect(noticed.message).toBe('操作に失敗しました。時間をおいて再度お試しください。');
  });

  it('uses schema message when error message references field issues', () => {
    const schemaError = { message: ' Field missing in payload ', code: '500' };

    const noticed = withUserMessage(schemaError, 'ignored');

    expect(noticed.userMessage).toBe('項目定義が最新ではありません。システム管理者に連絡してください。');
    expect(noticed.message).toBe('Field missing in payload');
  });

  it('falls back to provided message when no rule matches and trims fallback', () => {
    const genericError = { message: '', code: 'E_UNKNOWN' };

    const noticed = withUserMessage(genericError, '  custom   message  ');

    expect(noticed.userMessage).toBe('custom message');
    expect(noticed.message).toBe('操作に失敗しました。時間をおいて再度お試しください。');
  });
});

describe('showDemoWriteDisabled', () => {
  beforeEach(() => {
    allowWriteFallback.mockReset();
    isDemoModeEnabled.mockReset();
  });

  it('notifies that writes are disabled when fallback is disallowed', () => {
    allowWriteFallback.mockReturnValue(false);
    isDemoModeEnabled.mockReturnValue(true);
    const notifySpy = vi.fn();

    showDemoWriteDisabled(notifySpy);

    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(notifySpy).toHaveBeenCalledWith('現在、この環境では書き込みが許可されていません。');
    expect(isDemoModeEnabled).toHaveBeenCalledTimes(1);
  });

  it('warns about demo mode when fallback allowed and demo enabled', () => {
    allowWriteFallback.mockReturnValue(true);
    isDemoModeEnabled.mockReturnValue(true);
    const notifySpy = vi.fn();

    showDemoWriteDisabled(notifySpy);

    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(notifySpy).toHaveBeenCalledWith('デモモードでは書き込みは保存されません。');
  });

  it('does nothing when fallback allowed but demo disabled', () => {
    allowWriteFallback.mockReturnValue(true);
    isDemoModeEnabled.mockReturnValue(false);
    const notifySpy = vi.fn();

    showDemoWriteDisabled(notifySpy);

    expect(notifySpy).not.toHaveBeenCalled();
  });
});

describe('registerNotifier / notify', () => {
  beforeEach(() => {
    registerNotifier(null);
  });

  it('delivers notifications when handler registered', () => {
    const handler = vi.fn();
    registerNotifier(handler);

    notify('hello');

    expect(handler).toHaveBeenCalledWith('hello');
  });

  it('ignores notify when no handler registered', () => {
    const handler = vi.fn();
    registerNotifier(null);

    notify('ignored');

    expect(handler).not.toHaveBeenCalled();
    expect(getRegisteredNotifier()).toBeNull();
  });
});
