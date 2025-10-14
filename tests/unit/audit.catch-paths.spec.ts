import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { pushAudit, retainAuditWhere } from '../../src/lib/audit';

const AUDIT_KEY = 'audit_log_v1';

const originalLocalStorage = globalThis.localStorage;

const createStorageStub = () => {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    key: vi.fn((index: number) => Array.from(store.keys())[index] ?? null),
    get length() {
      return store.size;
    },
    store,
  };
};

describe('audit catch paths', () => {
  beforeEach(() => {
    const stub = createStorageStub();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: stub,
    });
  });

  afterAll(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: originalLocalStorage,
    });
  });

  it('logs and swallows errors when localStorage.setItem throws during pushAudit', () => {
    const storage = globalThis.localStorage as ReturnType<typeof createStorageStub>;
    storage.getItem.mockReturnValue(JSON.stringify([]));
    const error = new Error('quota exceeded');
    storage.setItem.mockImplementation(() => {
      throw error;
    });

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() =>
      pushAudit({
        actor: 'tester',
        action: 'CREATE',
        entity: 'schedule',
        channel: 'UI',
        before: { step: 'start' },
        after: { note: 'storage write fails' },
      })
    ).not.toThrow();

    expect(consoleError).toHaveBeenCalledWith('Failed to write audit log to localStorage:', error);

    consoleError.mockRestore();
  });

  it('logs when retainAuditWhere cannot persist filtered audit log', () => {
    const storage = globalThis.localStorage as ReturnType<typeof createStorageStub>;
    const existing = [
      {
        ts: '2025-01-01T00:00:00.000Z',
        actor: 'tester',
        action: 'CREATE',
        entity: 'schedule',
        channel: 'UI' as const,
      },
      {
        ts: '2025-01-02T00:00:00.000Z',
        actor: 'tester',
        action: 'KEEP',
        entity: 'schedule',
        channel: 'UI' as const,
      },
    ];
    storage.getItem.mockReturnValue(JSON.stringify(existing));
    storage.store.set(AUDIT_KEY, JSON.stringify(existing));
    const error = new Error('persist failed');
    storage.setItem.mockImplementation(() => {
      throw error;
    });

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  expect(() => retainAuditWhere((entry) => entry.action === 'KEEP')).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith('Failed to retain subset of audit log:', error);

    consoleError.mockRestore();
  });
});
