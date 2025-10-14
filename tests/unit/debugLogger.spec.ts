import { afterEach, describe, expect, it, vi } from 'vitest';

const mockConsole = () => {
  const original = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
  const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  return {
    restore: () => {
      debugSpy.mockRestore();
      infoSpy.mockRestore();
      warnSpy.mockRestore();
      errorSpy.mockRestore();
      console.debug = original.debug;
      console.info = original.info;
      console.warn = original.warn;
      console.error = original.error;
    },
    debugSpy,
    infoSpy,
    warnSpy,
    errorSpy,
  };
};

describe('auditLog', () => {
  afterEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  it('suppresses debug logs when debug mode disabled but forwards others', async () => {
    const consoleSpies = mockConsole();
    vi.doMock('@/lib/env', () => ({
      getAppConfig: () => ({ VITE_AUDIT_DEBUG: '0' }),
    }));

    const { auditLog } = await import('@/lib/debugLogger');

    auditLog.debug('ns', 'hidden');
    auditLog.info('ns', 'info message');
    auditLog.warn('ns', 'warn message');
    auditLog.error('ns', 'error message');

    expect(consoleSpies.debugSpy).not.toHaveBeenCalled();
    expect(consoleSpies.infoSpy).toHaveBeenCalledWith('[audit:ns]', 'info message');
    expect(consoleSpies.warnSpy).toHaveBeenCalledWith('[audit:ns]', 'warn message');
    expect(consoleSpies.errorSpy).toHaveBeenCalledWith('[audit:ns]', 'error message');

    consoleSpies.restore();
  });

  it('emits debug logs when audit debug flag enabled', async () => {
    const consoleSpies = mockConsole();
    vi.doMock('@/lib/env', () => ({
      getAppConfig: () => ({ VITE_AUDIT_DEBUG: 'true' }),
    }));

    const { auditLog } = await import('@/lib/debugLogger');

    auditLog.debug('ns', 'visible');

    expect(consoleSpies.debugSpy).toHaveBeenCalledWith('[audit:ns]', 'visible');

    consoleSpies.restore();
  });
});
