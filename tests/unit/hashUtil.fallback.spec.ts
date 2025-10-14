import { afterEach, describe, expect, it, vi } from 'vitest';

const targetModule = '@/lib/hashUtil';

describe('hashUtil sha256 fallback', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('uses Node webcrypto when global crypto is unavailable', async () => {
    vi.resetModules();
    vi.stubGlobal('crypto', undefined as unknown as Crypto);

    const digest = vi.fn().mockResolvedValue(Uint8Array.from([0, 15, 255]).buffer);

    vi.doMock('crypto', () => ({
      webcrypto: {
        subtle: {
          digest
        }
      }
    }));

  const { sha256Hex } = await import(targetModule);

    const result = await sha256Hex('fallback-test');

    expect(digest).toHaveBeenCalledTimes(1);
    const [algorithm, data] = digest.mock.calls[0];
    expect(algorithm).toBe('SHA-256');
    expect(new TextDecoder().decode(new Uint8Array(data as ArrayBuffer))).toBe('fallback-test');
    expect(result).toBe('000fff');
  });
});
