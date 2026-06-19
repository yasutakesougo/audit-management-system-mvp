import { beforeEach, describe, expect, it, vi } from 'vitest';
import { guardProdMisconfig } from './envGuards';

const getAppConfigMock = vi.hoisted(() => vi.fn());
const isE2EMock = vi.hoisted(() => vi.fn());
const shouldSkipSharePointMock = vi.hoisted(() => vi.fn());

vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./env')>();
  return {
    ...actual,
    getAppConfig: () => getAppConfigMock(),
    isE2E: () => isE2EMock(),
  };
});

vi.mock('@/lib/sharepoint/skipSharePoint', () => ({
  shouldSkipSharePoint: () => shouldSkipSharePointMock(),
}));

describe('guardProdMisconfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('isDev が false, isE2E が false, SharePoint を skip するときに throw する', () => {
    getAppConfigMock.mockReturnValue({ isDev: false });
    isE2EMock.mockReturnValue(false);
    shouldSkipSharePointMock.mockReturnValue(true);

    expect(() => {
      guardProdMisconfig();
    }).toThrow('[config] VITE_SKIP_SHAREPOINT=1 is not allowed in PROD. Check environment configuration.');
  });

  it('isDev が true の場合は throw しない', () => {
    getAppConfigMock.mockReturnValue({ isDev: true });
    isE2EMock.mockReturnValue(false);
    shouldSkipSharePointMock.mockReturnValue(true);

    expect(() => {
      guardProdMisconfig();
    }).not.toThrow();
  });

  it('isE2E が true の場合は throw しない', () => {
    getAppConfigMock.mockReturnValue({ isDev: false });
    isE2EMock.mockReturnValue(true);
    shouldSkipSharePointMock.mockReturnValue(true);

    expect(() => {
      guardProdMisconfig();
    }).not.toThrow();
  });
});
