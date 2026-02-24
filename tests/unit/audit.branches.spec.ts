import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pushAudit, readAudit, retainAuditWhere } from '../../src/lib/audit';

// Helper for in-memory localStorage
const createInMemoryStorage = (): Storage => {
  const store: Record<string, string> = {};
  return {
    length: 0,
    clear: function() {
      for (const k in store) delete store[k];
    },
    getItem: (key: string) => store[key] || null,
    key: (index: number) => Object.keys(store)[index] || null,
    removeItem: (key: string) => {
      delete store[key];
    },
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
  };
};

describe('audit localStorage error branches', () => {
  let consoleError: MockInstance;
  let mem: Storage;

  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mem = createInMemoryStorage();
    vi.stubGlobal('localStorage', mem);
  });

  afterEach(() => {
    consoleError.mockRestore();
    vi.unstubAllGlobals();
  });

  it('readAudit handles malformed JSON and clears corrupt entry', () => {
    const removeItem = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => '{'),
      setItem: vi.fn(),
      removeItem,
      clear: vi.fn(),
      length: 1,
      key: vi.fn(),
    });

    const logs = readAudit();

    expect(logs).toEqual([]);
    expect(removeItem).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  it('pushAudit swallows write errors after reading existing logs', () => {
    const setItem = vi.fn(() => {
      throw new Error('quota exceeded');
    });
    const getItem = vi.fn(() => '[]');
    vi.stubGlobal('localStorage', {
      getItem,
      setItem,
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    });

    expect(() => pushAudit({ actor: 'u', action: 'TEST', entity: 'X', channel: 'UI' })).not.toThrow();
    expect(getItem).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('Failed to write audit log'), expect.any(Error));
  });

  it('retainAuditWhere removes all entries when predicate filters everything out', () => {
    const stored = JSON.stringify([
      { ts: '1', actor: 'a', action: 'CREATE', entity: 'E', channel: 'UI' },
      { ts: '2', actor: 'b', action: 'UPDATE', entity: 'E', channel: 'UI' },
    ]);
    const removeItem = vi.fn();
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', {
      getItem: vi.fn(() => stored),
      setItem,
      removeItem,
      clear: vi.fn(),
      length: 1,
      key: vi.fn(),
    });

    retainAuditWhere(() => false);

    expect(removeItem).toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});
