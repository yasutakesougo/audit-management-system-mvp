import { describe, expect, it } from 'vitest';
import { initMsalMock, resetMsalMockSignal } from '@/auth/msalMock';

describe('msal mock helpers', () => {
  it('exposes initMsalMock without throwing', () => {
    expect(() => initMsalMock()).not.toThrow();
  });

  it('exposes resetMsalMockSignal without throwing', () => {
    expect(() => resetMsalMockSignal()).not.toThrow();
  });
});
