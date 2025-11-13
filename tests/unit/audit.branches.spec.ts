import type { MockInstance } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pushAudit, readAudit, retainAuditWhere } from '../../src/lib/audit';

describe('audit localStorage error branches', () => {
  let consoleError: MockInstance;
  beforeEach(() => {
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleError.mockRestore();
  });

  it('readAudit handles malformed JSON and clears corrupt entry', () => {
    const removeItem = vi.fn();
    global.localStorage = {
      getItem: vi.fn(() => '{'),
      setItem: vi.fn(),
      removeItem,
      clear: vi.fn(),
    } as unknown as Storage;

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
    global.localStorage = {
      getItem,
      setItem,
      removeItem: vi.fn(),
      clear: vi.fn(),
    } as unknown as Storage;

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
    global.localStorage = {
      getItem: vi.fn(() => stored),
      setItem,
      removeItem,
      clear: vi.fn(),
    } as unknown as Storage;

    retainAuditWhere(() => false);

    expect(removeItem).toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
  });
});
