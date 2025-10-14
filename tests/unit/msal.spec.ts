import { afterEach, describe, expect, it, vi } from 'vitest';
import { createE2EMsalAccount, persistMsalToken } from '@/lib/msal';

type SessionWindow = { sessionStorage: { setItem: (key: string, value: string) => void } };

const globalWithWindow = globalThis as { window?: SessionWindow };
const originalWindow = globalWithWindow.window;

afterEach(() => {
  if (originalWindow) {
    globalWithWindow.window = originalWindow;
  } else {
    Reflect.deleteProperty(globalWithWindow, 'window');
  }
});

describe('msal helpers', () => {
  it('creates a deterministic E2E account stub', () => {
    const account = createE2EMsalAccount();
    expect(account).toMatchObject({
      homeAccountId: 'e2e-home-account',
      username: 'e2e.user@example.com',
      tenantId: 'e2e-tenant',
    });
  });

  it('skips persistence when window is not available', () => {
  Reflect.deleteProperty(globalWithWindow, 'window');
    expect(() => persistMsalToken('token')).not.toThrow();
  });

  it('stores token in sessionStorage when available', () => {
    const setItem = vi.fn();
    globalWithWindow.window = {
      sessionStorage: { setItem },
    };

    persistMsalToken('token');

    expect(setItem).toHaveBeenCalledWith('spToken', 'token');
  });

  it('swallows storage exceptions during persistence', () => {
    const setItem = vi.fn(() => {
      throw new Error('blocked');
    });
    globalWithWindow.window = {
      sessionStorage: { setItem },
    };

    expect(() => persistMsalToken('token')).not.toThrow();
    expect(setItem).toHaveBeenCalled();
  });
});
