import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addAuditLog, pushAudit, retainAuditWhere } from '../../src/lib/audit';

describe('audit helpers additional branches', () => {
  class MemoryStorage {
    store: Record<string, string> = {};
    getItem(key: string) {
      return this.store[key] ?? null;
    }
    setItem(key: string, value: string) {
      this.store[key] = value;
    }
    removeItem(key: string) {
      delete this.store[key];
    }
    clear() {
      this.store = {};
    }
  }

  const AUDIT_KEY = 'audit_log_v1';

  beforeEach(() => {
    vi.restoreAllMocks();
    const mem = new MemoryStorage();
    mem.clear();
    vi.stubGlobal('localStorage', mem);
  });

  it('truncates audit log when exceeding MAX_LOGS and prepends new event', () => {
    const existing = Array.from({ length: 500 }, (_, index) => ({
      ts: `2025-01-01T00:00:00.${index.toString().padStart(3, '0')}Z`,
      actor: 'user',
      action: 'NOOP',
      entity: 'Test',
      channel: 'UI',
    }));
    localStorage.setItem(AUDIT_KEY, JSON.stringify(existing));

    pushAudit({ actor: 'u2', action: 'CREATE', entity: 'Test', channel: 'UI' });

    const stored = JSON.parse(localStorage.getItem(AUDIT_KEY) ?? '[]');
    expect(stored).toHaveLength(500);
    expect(stored[0].actor).toBe('u2');
    expect(stored.at(-1)?.actor).toBe('user');
  });

  it('retainAuditWhere keeps filtered subset and persists to storage', () => {
    const events = [
      { ts: '1', actor: 'a', action: 'CREATE', entity: 'X', channel: 'UI' },
      { ts: '2', actor: 'b', action: 'UPDATE', entity: 'Y', channel: 'UI' },
    ];
    const setSpy = vi.spyOn(localStorage, 'setItem');
    localStorage.setItem(AUDIT_KEY, JSON.stringify(events));

    retainAuditWhere((ev) => ev.actor === 'b');

    expect(setSpy).toHaveBeenCalledWith(AUDIT_KEY, JSON.stringify([events[1]]));
  });

  it('retainAuditWhere handles storage errors gracefully', () => {
    const erroringStorage = {
      getItem: vi.fn(() => {
        throw new Error('boom');
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    } as unknown as Storage;
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.localStorage = erroringStorage;

    retainAuditWhere(() => true);

    expect(consoleError).toHaveBeenCalledWith(
      'Failed to read audit log from localStorage:',
      expect.any(Error)
    );
  });

  it('addAuditLog forwards to pushAudit with legacy shape', () => {
    const setSpy = vi.spyOn(localStorage, 'setItem');
    addAuditLog({
      ts: 'ignored',
      actor: 'legacy',
      action: 'SYNC',
      entity: 'Records',
      entity_id: '1',
      channel: 'UI',
      before: { a: 1 },
      after: { b: 2 },
    });

    expect(setSpy).toHaveBeenCalled();
    const stored = JSON.parse(localStorage.getItem(AUDIT_KEY) ?? '[]');
    expect(stored[0]).toMatchObject({ actor: 'legacy', entity_id: '1' });
  });
});
