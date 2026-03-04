import { describe, expect, it } from 'vitest';
import { InteractionStatus } from '../interactionStatus';

describe('InteractionStatus', () => {
  it('exposes all expected status values', () => {
    expect(InteractionStatus.Startup).toBe('startup');
    expect(InteractionStatus.Login).toBe('login');
    expect(InteractionStatus.AcquireToken).toBe('acquireToken');
    expect(InteractionStatus.SsoSilent).toBe('ssoSilent');
    expect(InteractionStatus.HandleRedirect).toBe('handleRedirect');
    expect(InteractionStatus.Logout).toBe('logout');
    expect(InteractionStatus.None).toBe('none');
  });

  it('contains exactly 7 status values', () => {
    const keys = Object.keys(InteractionStatus);
    expect(keys).toHaveLength(7);
  });

  it('has unique values (no duplicates)', () => {
    const values = Object.values(InteractionStatus);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });
});
