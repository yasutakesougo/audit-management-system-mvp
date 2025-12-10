import { beforeEach, describe, expect, it, vi } from 'vitest';
import { warmAll, warmAsync, warmDataEntryComponents, warmTableComponents } from '../warm';

// MUI modules のモック
vi.mock('@mui/material/Table', () => ({ default: () => null }));
vi.mock('@mui/material/TableBody', () => ({ default: () => null }));
vi.mock('@mui/material/TableCell', () => ({ default: () => null }));
vi.mock('@mui/material/TableContainer', () => ({ default: () => null }));
vi.mock('@mui/material/TableHead', () => ({ default: () => null }));
vi.mock('@mui/material/TableRow', () => ({ default: () => null }));
vi.mock('@mui/material/Paper', () => ({ default: () => null }));
vi.mock('@mui/material/Card', () => ({ default: () => null }));
vi.mock('@mui/material/CardContent', () => ({ default: () => null }));
vi.mock('@mui/material/Dialog', () => ({ default: () => null }));
vi.mock('@mui/material/DialogTitle', () => ({ default: () => null }));
vi.mock('@mui/material/DialogContent', () => ({ default: () => null }));
vi.mock('@mui/material/DialogActions', () => ({ default: () => null }));
vi.mock('@mui/material/TextField', () => ({ default: () => null }));
vi.mock('@mui/material/Select', () => ({ default: () => null }));
vi.mock('@mui/material/MenuItem', () => ({ default: () => null }));
vi.mock('@mui/material/Switch', () => ({ default: () => null }));
vi.mock('@mui/material/Chip', () => ({ default: () => null }));
vi.mock('@mui/material/Alert', () => ({ default: () => null }));
vi.mock('@mui/material/Snackbar', () => ({ default: () => null }));

describe('mui/warm', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  describe('warmTableComponents', () => {
    it('should preload table components successfully', async () => {
      await expect(warmTableComponents()).resolves.toBeUndefined();
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should handle import failures gracefully', async () => {
      // Mock import failure for one component
      vi.doMock('@mui/material/Table', () => Promise.reject(new Error('Import failed')));

      await expect(warmTableComponents()).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[mui warm] table components preload failed (non-fatal)'
      );
    });

    it('should not log warnings in non-browser environment', async () => {
      const originalWindow = global.window;
      // @ts-ignore - テスト用のwindow削除
      delete global.window;

      vi.doMock('@mui/material/Table', () => Promise.reject(new Error('Import failed')));

      await warmTableComponents();
      expect(consoleSpy).not.toHaveBeenCalled();

      // Restore window
      global.window = originalWindow;
    });
  });

  describe('warmDataEntryComponents', () => {
    it('should preload data entry components successfully', async () => {
      await expect(warmDataEntryComponents()).resolves.toBeUndefined();
      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it('should handle import failures gracefully', async () => {
      vi.doMock('@mui/material/Dialog', () => Promise.reject(new Error('Import failed')));

      await expect(warmDataEntryComponents()).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[mui warm] data entry components preload failed (non-fatal)'
      );
    });
  });

  describe('warmAll', () => {
    it('should run both warm functions in parallel', async () => {
      const startTime = Date.now();
      await warmAll();
      const endTime = Date.now();

      // Should complete quickly since running in parallel
      expect(endTime - startTime).toBeLessThan(100);
      // Both functions are mocked, so no warnings should occur
    });

    it('should handle partial failures gracefully', async () => {
      // Mock one warm function to fail
      vi.doMock('@mui/material/Table', () => Promise.reject(new Error('Import failed')));

      await expect(warmAll()).resolves.toBeUndefined();
      // Should have warnings for both table and data entry components
      expect(consoleSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('warmAsync', () => {
    it('should not throw errors even if warmAll fails', async () => {
      // Mock all imports to fail
      vi.doMock('@mui/material/Table', () => Promise.reject(new Error('Import failed')));
      vi.doMock('@mui/material/Dialog', () => Promise.reject(new Error('Import failed')));

      // Should not throw - fire and forget
      expect(() => warmAsync()).not.toThrow();
    });

    it('should be truly fire-and-forget', () => {
      const result = warmAsync();
      expect(result).toBeUndefined();
    });
  });

  describe('error handling consistency', () => {
    it('should handle network errors gracefully', async () => {
      const networkError = new Error('Network request failed');
      vi.doMock('@mui/material/Table', () => Promise.reject(networkError));

      await expect(warmTableComponents()).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[mui warm] table components preload failed (non-fatal)'
      );
    });

    it('should handle module resolution errors gracefully', async () => {
      const moduleError = new Error('Module not found');
      vi.doMock('@mui/material/Dialog', () => Promise.reject(moduleError));

      await expect(warmDataEntryComponents()).resolves.toBeUndefined();
      expect(consoleSpy).toHaveBeenCalledWith(
        '[mui warm] data entry components preload failed (non-fatal)'
      );
    });
  });

  describe('browser environment detection', () => {
    it('should detect window object correctly', async () => {
      expect(typeof window).toBe('object');

      vi.doMock('@mui/material/Table', () => Promise.reject(new Error('Test error')));
      await warmTableComponents();

      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should detect console object correctly', async () => {
      expect(typeof console).toBe('object');
      expect(typeof console.warn).toBe('function');
    });
  });

  describe('performance characteristics', () => {
    it('should complete table component warming within reasonable time', async () => {
      const startTime = performance.now();
      await warmTableComponents();
      const duration = performance.now() - startTime;

      // Should be very fast since components are mocked
      expect(duration).toBeLessThan(50);
    });

    it('should complete data entry warming within reasonable time', async () => {
      const startTime = performance.now();
      await warmDataEntryComponents();
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(50);
    });
  });
});