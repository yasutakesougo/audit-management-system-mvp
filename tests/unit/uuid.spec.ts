import { describe, it, expect, vi } from 'vitest';
import { safeRandomUUID } from '@/lib/uuid';

describe('safeRandomUUID', () => {
  it('returns value when crypto.randomUUID missing', () => {
    const original = (globalThis as any).crypto;
    // emulate missing crypto
    (globalThis as any).crypto = undefined;
    const v = safeRandomUUID();
    expect(typeof v).toBe('string');
    expect(v.length).toBeGreaterThan(10);
    (globalThis as any).crypto = original; // restore
  });

  it('uses crypto.randomUUID when available', () => {
    const mock = { randomUUID: vi.fn().mockReturnValue('uuid-1') };
    (globalThis as any).crypto = mock;
    const v = safeRandomUUID();
    expect(v).toBe('uuid-1');
  });
});
