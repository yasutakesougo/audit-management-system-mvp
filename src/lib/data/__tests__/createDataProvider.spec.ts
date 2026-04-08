import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  isDevMode: vi.fn(),
  isDemoModeEnabled: vi.fn(),
  shouldSkipSharePoint: vi.fn(),
  readBool: vi.fn(),
  readOptionalEnv: vi.fn(),
  isTestMode: vi.fn(),
}));

import * as envModule from '@/lib/env';

describe('getActiveProviderType Priority Contract', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    // Default mock behavior
    vi.mocked(envModule.isDevMode).mockReturnValue(false);
    vi.mocked(envModule.isDemoModeEnabled).mockReturnValue(false);
    vi.mocked(envModule.shouldSkipSharePoint).mockReturnValue(false);
    vi.mocked(envModule.readBool).mockReturnValue(false);
    vi.mocked(envModule.readOptionalEnv).mockReturnValue(undefined);
    vi.mocked(envModule.isTestMode).mockReturnValue(false);
  });

  it('CASE: VITE_DATA_PROVIDER=local should return local', async () => {
    vi.mocked(envModule.readOptionalEnv).mockImplementation((key: string) =>
      key === 'VITE_DATA_PROVIDER' ? 'local' : undefined,
    );

    const { getActiveProviderType } = await import('../createDataProvider');

    expect(getActiveProviderType()).toBe('local');
    expect(envModule.readOptionalEnv).toHaveBeenCalledWith('VITE_DATA_PROVIDER');
  });

  it('CASE: VITE_FORCE_SHAREPOINT=true should return sharepoint', async () => {
    vi.mocked(envModule.readBool).mockImplementation((key: string, defaultValue?: boolean) =>
      key === 'VITE_FORCE_SHAREPOINT' ? true : defaultValue ?? false,
    );

    const { getActiveProviderType } = await import('../createDataProvider');

    expect(getActiveProviderType()).toBe('sharepoint');
    expect(envModule.readBool).toHaveBeenCalledWith('VITE_FORCE_SHAREPOINT', false);
  });

  it('CASE: should return memory in test mode if no other flags', async () => {
    vi.mocked(envModule.isTestMode).mockReturnValue(true);

    const { getActiveProviderType } = await import('../createDataProvider');

    expect(getActiveProviderType()).toBe('memory');
    expect(envModule.isTestMode).toHaveBeenCalled();
  });

  it('CASE: should return memory in demo mode', async () => {
    vi.mocked(envModule.isDemoModeEnabled).mockReturnValue(true);

    const { getActiveProviderType } = await import('../createDataProvider');

    expect(getActiveProviderType()).toBe('memory');
  });

  it('CASE: should return memory in dev mode', async () => {
    vi.mocked(envModule.isDevMode).mockReturnValue(true);

    const { getActiveProviderType } = await import('../createDataProvider');

    expect(getActiveProviderType()).toBe('memory');
  });

  it('CASE: should return sharepoint as final fallback', async () => {
    const { getActiveProviderType } = await import('../createDataProvider');

    expect(getActiveProviderType()).toBe('sharepoint');
  });

  describe('Priority Rules', () => {
    it('rule: VITE_FORCE_SHAREPOINT should override test fallback', async () => {
      vi.mocked(envModule.isTestMode).mockReturnValue(true);
      vi.mocked(envModule.readBool).mockImplementation((key: string, defaultValue?: boolean) =>
        key === 'VITE_FORCE_SHAREPOINT' ? true : defaultValue ?? false,
      );

      const { getActiveProviderType } = await import('../createDataProvider');

      expect(getActiveProviderType()).toBe('sharepoint');
    });

    it('rule: VITE_DATA_PROVIDER should override fallback modes', async () => {
      vi.mocked(envModule.isDevMode).mockReturnValue(true);
      vi.mocked(envModule.readOptionalEnv).mockImplementation((key: string) =>
        key === 'VITE_DATA_PROVIDER' ? 'sharepoint' : undefined,
      );

      const { getActiveProviderType } = await import('../createDataProvider');

      // VITE_DATA_PROVIDER (explicit) > isDev fallback
      expect(getActiveProviderType()).toBe('sharepoint');
    });

    it('rule: shouldSkipSharePoint should override everything including URL params (Safety First)', async () => {
      vi.mocked(envModule.shouldSkipSharePoint).mockReturnValue(true);
      
      // Mock window.location for URL params
      const mockLocation = { search: '?provider=sharepoint' };
      vi.stubGlobal('window', { location: mockLocation });

      const { getActiveProviderType } = await import('../createDataProvider');

      expect(getActiveProviderType()).toBe('memory');
    });

    it('rule: URL param should override VITE_DATA_PROVIDER env', async () => {
      vi.mocked(envModule.readOptionalEnv).mockImplementation((key: string) =>
        key === 'VITE_DATA_PROVIDER' ? 'local' : undefined,
      );
      
      const mockLocation = { search: '?provider=sharepoint' };
      vi.stubGlobal('window', { location: mockLocation });

      const { getActiveProviderType } = await import('../createDataProvider');

      expect(getActiveProviderType()).toBe('sharepoint');
    });
  });
});
