import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  localStorage.clear();
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('audit final catch branches', () => {
  it('swallows write failures when pushing audit events', async () => {
    const setSpy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    vi.resetModules();
    const { pushAudit } = await import('@/lib/audit');

    expect(() =>
      pushAudit({
        actor: 'tester',
        action: 'CREATE',
        entity: 'UnitTest',
        channel: 'UI',
      })
    ).not.toThrow();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to write audit log to localStorage:',
      expect.any(Error)
    );

    setSpy.mockRestore();
  });

  it('handles retain failures when localStorage.removeItem throws', async () => {
    const getSpy = vi.spyOn(window.localStorage, 'getItem').mockReturnValue(
      JSON.stringify([
        {
          ts: '2025-05-01T00:00:00.000Z',
          actor: 'tester',
          action: 'UPDATE',
          entity: 'UnitTest',
          channel: 'UI',
        },
      ])
    );
    const removeSpy = vi.spyOn(window.localStorage, 'removeItem').mockImplementation(() => {
      throw new Error('locked');
    });

    vi.resetModules();
    const { retainAuditWhere } = await import('@/lib/audit');

    expect(() => retainAuditWhere(() => false)).not.toThrow();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to retain subset of audit log:',
      expect.any(Error)
    );

    getSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
