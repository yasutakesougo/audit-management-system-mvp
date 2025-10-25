import { beforeEach, describe, expect, it, vi } from 'vitest';

const AUDIT_KEY = 'audit_log_v1';

const sampleEvents = [
  {
    ts: '2024-01-01T00:00:00.000Z',
    actor: 'alice',
    action: 'create',
    entity: 'Users',
    channel: 'UI' as const,
  },
  {
    ts: '2024-01-02T00:00:00.000Z',
    actor: 'system',
    action: 'sync',
    entity: 'Jobs',
    channel: 'System' as const,
  },
];

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('retainAuditWhere', () => {
  it('keeps matching audit events and discards others', async () => {
    localStorage.setItem(AUDIT_KEY, JSON.stringify(sampleEvents));
    const audit = await import('@/lib/audit');

  audit.retainAuditWhere((event: any) => event.channel === 'UI');

    const stored = localStorage.getItem(AUDIT_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored ?? '[]');
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.channel).toBe('UI');
  });

  it('handles storage failures when removing filtered logs', async () => {
    let stored = JSON.stringify(sampleEvents);
    const originalStorage = window.localStorage;
    const fakeStorage = {
      getItem: vi.fn((key: string) => (key === AUDIT_KEY ? stored : null)),
      setItem: vi.fn((key: string, value: string) => {
        if (key === AUDIT_KEY) {
          stored = value;
        }
      }),
      removeItem: vi.fn(() => {
        throw new Error('quota exceeded');
      }),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } as unknown as Storage;

    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: fakeStorage,
    });

    try {
      const audit = await import('@/lib/audit');
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => audit.retainAuditWhere(() => false)).not.toThrow();
      expect(fakeStorage.removeItem).toHaveBeenCalledWith(AUDIT_KEY);
      expect(errorSpy).toHaveBeenCalled();
      expect(errorSpy.mock.calls[0]?.[0]).toBe('Failed to retain subset of audit log:');
      expect(errorSpy.mock.calls[0]?.[1]).toBeInstanceOf(Error);
    } finally {
      Object.defineProperty(window, 'localStorage', {
        configurable: true,
        value: originalStorage,
      });
    }
  });
});
