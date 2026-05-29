import { describe, it, expect } from 'vitest';
import { mergeKioskSearchParams, appendKioskSearchParams } from '../navigation';

describe('kiosk navigation utilities', () => {
  describe('mergeKioskSearchParams', () => {
    it('should merge extra params and keep existing params', () => {
      const current = '?kiosk=1&provider=memory';
      const result = mergeKioskSearchParams(current, { extra: 'value', provider: 'local' });
      expect(result).toContain('kiosk=1');
      expect(result).toContain('provider=local');
      expect(result).toContain('extra=value');
    });

    it('should remove param if value is null or undefined', () => {
      const current = '?kiosk=1&provider=memory';
      const result = mergeKioskSearchParams(current, { provider: null as any });
      expect(result).toContain('kiosk=1');
      expect(result).not.toContain('provider');
    });
  });

  describe('appendKioskSearchParams', () => {
    it('preserves diagnostic params while clearing stale kiosk state params', () => {
      const current = '?highlight=sp_bootstrap_blocked&list=Users_Master&userId=stale&user=old&slotId=old&step=2&kiosk=1';
      const result = appendKioskSearchParams('/kiosk/users', current);

      const params = new URLSearchParams(result.split('?')[1]);
      // State params must be removed
      expect(params.has('userId')).toBe(false);
      expect(params.has('user')).toBe(false);
      expect(params.has('slotId')).toBe(false);
      expect(params.has('step')).toBe(false);

      // Diagnostic & utility params must be preserved
      expect(params.get('highlight')).toBe('sp_bootstrap_blocked');
      expect(params.get('list')).toBe('Users_Master');
      expect(params.get('kiosk')).toBe('1');
    });

    it('merges extra params without dropping diagnostic params', () => {
      const current = '?highlight=sp_bootstrap_blocked&list=Users_Master&kiosk=1';
      const result = appendKioskSearchParams('/kiosk/users', current, { extra: 'value', highlight: 'new_value' });

      const params = new URLSearchParams(result.split('?')[1]);
      expect(params.get('highlight')).toBe('new_value'); // Overwritten
      expect(params.get('list')).toBe('Users_Master');     // Preserved
      expect(params.get('kiosk')).toBe('1');
      expect(params.get('extra')).toBe('value');
    });

    it('does not clear state params for non-kiosk paths', () => {
      const current = '?userId=active&slotId=123';
      const result = appendKioskSearchParams('/admin/dashboard', current);

      const params = new URLSearchParams(result.split('?')[1]);
      expect(params.get('userId')).toBe('active');
      expect(params.get('slotId')).toBe('123');
    });
  });
});
