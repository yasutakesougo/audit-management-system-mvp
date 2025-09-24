import { describe, it, expect, vi, afterEach } from 'vitest';
import { safeRandomUUID } from '../../src/lib/uuid';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('safeRandomUUID', () => {
  it('returns a UUID-looking string (generic smoke)', () => {
    const v = safeRandomUUID();
    expect(typeof v).toBe('string');
    expect(v.length).toBeGreaterThan(10);
  });

  it('uses native crypto.randomUUID when present (spied)', () => {
    const cr: any = (globalThis as any).crypto;
    if (cr && typeof cr.randomUUID === 'function') {
      const spy = vi.spyOn(cr, 'randomUUID').mockReturnValue('uuid-1');
      const v = safeRandomUUID();
      expect(v).toBe('uuid-1');
      expect(spy).toHaveBeenCalled();
    } else {
      // Environment lacks native randomUUID; fallback already tested above
      expect(typeof safeRandomUUID()).toBe('string');
    }
  });

  it('prefers injected implementation over native', () => {
    const injected = vi.fn().mockReturnValue('injected-uuid');
    const v = safeRandomUUID({ randomUUID: injected });
    expect(v).toBe('injected-uuid');
    expect(injected).toHaveBeenCalled();
  });
});
