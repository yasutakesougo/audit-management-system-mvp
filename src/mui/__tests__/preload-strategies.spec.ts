import { beforeEach, describe, expect, it, vi } from 'vitest';

// MUI warming functions のモック
const mockWarmTableComponents = vi.fn().mockResolvedValue(undefined);
const mockWarmDataEntryComponents = vi.fn().mockResolvedValue(undefined);
const mockWarmAll = vi.fn().mockResolvedValue(undefined);

vi.mock('../warm', () => ({
  warmTableComponents: mockWarmTableComponents,
  warmDataEntryComponents: mockWarmDataEntryComponents,
  warmAll: mockWarmAll,
  warmAsync: vi.fn()
}));

describe('mui/preload-strategies', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.clearAllMocks();

    // Mock navigator.connection
    Object.defineProperty(navigator, 'connection', {
      value: {
        effectiveType: '4g',
        saveData: false
      },
      configurable: true
    });
  });

  describe('routingPreloadStrategy', () => {
    it('should preload table components for data routes', async () => {
      const { routingPreloadStrategy } = await import('../preload-strategies');

      await routingPreloadStrategy('/audit-dashboard');

      expect(mockWarmTableComponents).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[preload] routing-based preload triggered for /audit-dashboard'
      );
    });

    it('should preload data entry components for entry routes', async () => {
      const { routingPreloadStrategy } = await import('../preload-strategies');

      await routingPreloadStrategy('/attendance-entry');

      expect(mockWarmDataEntryComponents).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[preload] routing-based preload triggered for /attendance-entry'
      );
    });

    it('should use warmAll for unknown routes', async () => {
      const { routingPreloadStrategy } = await import('../preload-strategies');

      await routingPreloadStrategy('/unknown-route');

      expect(mockWarmAll).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[preload] routing-based preload triggered for /unknown-route'
      );
    });
  });

  describe('adaptivePreload', () => {
    it('should skip preload when data saver is enabled', async () => {
      Object.defineProperty(navigator, 'connection', {
        value: { saveData: true },
        configurable: true
      });

      const { adaptivePreload } = await import('../preload-strategies');
      await adaptivePreload();

      expect(mockWarmAll).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[preload] skipping preload due to data saver mode'
      );
    });

    it('should skip preload on slow connection', async () => {
      Object.defineProperty(navigator, 'connection', {
        value: { effectiveType: 'slow-2g' },
        configurable: true
      });

      const { adaptivePreload } = await import('../preload-strategies');
      await adaptivePreload();

      expect(mockWarmAll).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[preload] skipping preload due to slow connection'
      );
    });

    it('should preload on good connection', async () => {
      const { adaptivePreload } = await import('../preload-strategies');
      await adaptivePreload();

      expect(mockWarmAll).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[preload] adaptive preload completed'
      );
    });
  });

  describe('speculativePreload', () => {
    it('should be fire-and-forget', async () => {
      const { speculativePreload } = await import('../preload-strategies');

      expect(() => speculativePreload()).not.toThrow();
      const result = speculativePreload();
      expect(result).toBeUndefined();
    });

    it('should log when started', async () => {
      const { speculativePreload } = await import('../preload-strategies');

      speculativePreload();

      expect(consoleSpy).toHaveBeenCalledWith(
        '[preload] speculative preload started'
      );
    });
  });
});