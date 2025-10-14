import { describe, it, expect, vi, afterEach } from 'vitest';
import { safeRandomUUID } from '../../src/lib/uuid';

const originalCryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

const setCrypto = (value: unknown): void => {
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
};

afterEach(() => {
  vi.restoreAllMocks();
  if (originalCryptoDescriptor) {
    Object.defineProperty(globalThis, 'crypto', originalCryptoDescriptor);
  } else {
    delete (globalThis as { crypto?: unknown }).crypto;
  }
});

describe('safeRandomUUID', () => {
  it('returns a UUID-looking string (generic smoke)', () => {
    const v = safeRandomUUID();
    expect(typeof v).toBe('string');
    expect(v.length).toBeGreaterThan(10);
  });

  it('uses native crypto.randomUUID when present (spied)', () => {
  const cr = (globalThis as { crypto?: Crypto & { randomUUID?: () => string } }).crypto;
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

  it('falls back to crypto.getRandomValues when randomUUID is missing', () => {
    const bytes = new Array(16).fill(0x11);
    setCrypto({
      getRandomValues: (buffer: Uint8Array) => {
        buffer.set(bytes);
        return buffer;
      },
    });

    const v = safeRandomUUID();

    expect(v).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it('uses Math.random fallback when crypto is unavailable', () => {
    delete (globalThis as { crypto?: unknown }).crypto;

    const v = safeRandomUUID();

    expect(typeof v).toBe('string');
    expect(v.length).toBeGreaterThan(10);
  });
});
