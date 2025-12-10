/**
 * Dashboard Core Logic Unit Tests
 *
 * Comprehensive test suite for dashboard business logic
 * following industrial-grade testing patterns.
 */

import { describe, expect, it } from 'vitest';
import {
    calculateProgressRate,
    DASHBOARD_KEYBOARD_SHORTCUTS,
    getCurrentMeetingMode,
    getMeetingStatus,
    isValidMeetingMode,
    matchKeyboardShortcut,
    resolveDefaultTabForMode,
    resolveTabToModeMapping,
    type MeetingMode
} from '../dashboardLogic';

describe('Dashboard Core Logic', () => {
  describe('resolveDefaultTabForMode', () => {
    it('should return tab 1 for morning mode', () => {
      expect(resolveDefaultTabForMode('morning')).toBe(1);
    });

    it('should return tab 2 for evening mode', () => {
      expect(resolveDefaultTabForMode('evening')).toBe(2);
    });

    it('should return default tab 0 for null mode', () => {
      expect(resolveDefaultTabForMode(null)).toBe(0);
    });
  });

  describe('getCurrentMeetingMode', () => {
    it('should detect morning meeting time', () => {
      // 8:50 AM - morning meeting prep
      const morningTime = new Date('2024-01-15 08:50:00');
      expect(getCurrentMeetingMode(morningTime)).toBe('morning');

      // 9:15 AM - morning meeting active
      const morningActiveTime = new Date('2024-01-15 09:15:00');
      expect(getCurrentMeetingMode(morningActiveTime)).toBe('morning');
    });

    it('should detect evening meeting time', () => {
      // 5:10 PM - evening meeting
      const eveningTime = new Date('2024-01-15 17:10:00');
      expect(getCurrentMeetingMode(eveningTime)).toBe('evening');
    });

    it('should return null for normal working hours', () => {
      // 10:30 AM - normal work time
      const normalTime = new Date('2024-01-15 10:30:00');
      expect(getCurrentMeetingMode(normalTime)).toBe(null);

      // 2:00 PM - afternoon work time
      const afternoonTime = new Date('2024-01-15 14:00:00');
      expect(getCurrentMeetingMode(afternoonTime)).toBe(null);
    });

    it('should handle edge cases correctly', () => {
      // Just before morning meeting
      const beforeMorning = new Date('2024-01-15 08:49:00');
      expect(getCurrentMeetingMode(beforeMorning)).toBe(null);

      // Just after morning meeting
      const afterMorning = new Date('2024-01-15 09:16:00');
      expect(getCurrentMeetingMode(afterMorning)).toBe(null);

      // Just before evening meeting
      const beforeEvening = new Date('2024-01-15 17:09:00');
      expect(getCurrentMeetingMode(beforeEvening)).toBe(null);
    });
  });

  describe('getMeetingStatus', () => {
    it('should return correct status for morning meeting preparation', () => {
      const time = new Date('2024-01-15 08:55:00');
      const status = getMeetingStatus(time);

      expect(status.status).toBe('morning-ready');
      expect(status.message).toContain('朝会開始まで あと数分');
      expect(status.color).toBe('success.main');
    });

    it('should return correct status for morning meeting active', () => {
      const time = new Date('2024-01-15 09:10:00');
      const status = getMeetingStatus(time);

      expect(status.status).toBe('morning-active');
      expect(status.message).toContain('朝会進行中');
      expect(status.color).toBe('primary.main');
    });

    it('should return correct status for evening meeting', () => {
      const timeReady = new Date('2024-01-15 17:12:00');
      const statusReady = getMeetingStatus(timeReady);

      expect(statusReady.status).toBe('evening-ready');
      expect(statusReady.message).toContain('夕会開始まで あと数分');
      expect(statusReady.color).toBe('warning.main');

      const timeActive = new Date('2024-01-15 17:20:00');
      const statusActive = getMeetingStatus(timeActive);

      expect(statusActive.status).toBe('evening-active');
      expect(statusActive.message).toContain('夕会進行中');
      expect(statusActive.color).toBe('secondary.main');
    });

    it('should return normal status for regular hours', () => {
      const time = new Date('2024-01-15 14:30:00');
      const status = getMeetingStatus(time);

      expect(status.status).toBe('normal');
      expect(status.message).toBe('14:30');
      expect(status.color).toBe('text.secondary');
    });
  });

  describe('isValidMeetingMode', () => {
    it('should validate correct meeting modes', () => {
      expect(isValidMeetingMode(null)).toBe(true);
      expect(isValidMeetingMode('morning')).toBe(true);
      expect(isValidMeetingMode('evening')).toBe(true);
    });

    it('should reject invalid meeting modes', () => {
      expect(isValidMeetingMode('invalid')).toBe(false);
      expect(isValidMeetingMode('noon')).toBe(false);
      expect(isValidMeetingMode('')).toBe(false);
    });
  });

  describe('resolveTabToModeMapping', () => {
    it('should switch to morning mode when tab 1 selected', () => {
      expect(resolveTabToModeMapping(1, null)).toBe('morning');
      expect(resolveTabToModeMapping(1, 'evening')).toBe('morning');
    });

    it('should switch to evening mode when tab 2 selected', () => {
      expect(resolveTabToModeMapping(2, null)).toBe('evening');
      expect(resolveTabToModeMapping(2, 'morning')).toBe('evening');
    });

    it('should clear mode when other tabs selected', () => {
      expect(resolveTabToModeMapping(0, 'morning')).toBe(null);
      expect(resolveTabToModeMapping(3, 'evening')).toBe(null);
      expect(resolveTabToModeMapping(4, 'morning')).toBe(null);
    });

    it('should maintain current mode for same tab', () => {
      expect(resolveTabToModeMapping(1, 'morning')).toBe('morning');
      expect(resolveTabToModeMapping(2, 'evening')).toBe('evening');
      expect(resolveTabToModeMapping(0, null)).toBe(null);
    });
  });

  describe('calculateProgressRate', () => {
    it('should calculate correct percentage', () => {
      expect(calculateProgressRate(5, 10)).toBe(50);
      expect(calculateProgressRate(3, 4)).toBe(75);
      expect(calculateProgressRate(10, 10)).toBe(100);
    });

    it('should handle edge cases', () => {
      expect(calculateProgressRate(0, 10)).toBe(0);
      expect(calculateProgressRate(5, 0)).toBe(0);
      expect(calculateProgressRate(0, 0)).toBe(0);
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should match correct keyboard shortcuts', () => {
      // Test Alt+N for notifications
      const altNEvent = { key: 'n', altKey: true } as KeyboardEvent;
      const result = matchKeyboardShortcut(altNEvent);

      expect(result).toEqual({
        key: 'n',
        altKey: true,
        action: 'navigate',
        target: 'notifications'
      });
    });

    it('should not match incorrect key combinations', () => {
      // Test regular 'n' without Alt
      const plainNEvent = { key: 'n', altKey: false } as KeyboardEvent;
      expect(matchKeyboardShortcut(plainNEvent)).toBe(null);

      // Test unknown key combination
      const unknownEvent = { key: 'z', altKey: true } as KeyboardEvent;
      expect(matchKeyboardShortcut(unknownEvent)).toBe(null);
    });

    it('should have all expected shortcuts defined', () => {
      const shortcuts = DASHBOARD_KEYBOARD_SHORTCUTS;
      const shortcutKeys = shortcuts.map((s: { key: string }) => s.key);

      expect(shortcutKeys).toContain('n'); // notifications
      expect(shortcutKeys).toContain('s'); // search
      expect(shortcutKeys).toContain('m'); // morning mode
      expect(shortcutKeys).toContain('e'); // evening mode
      expect(shortcutKeys).toContain('p'); // print
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete workflow for morning meeting', () => {
      const morningTime = new Date('2024-01-15 09:00:00');

      // Check time detection
      const mode = getCurrentMeetingMode(morningTime);
      expect(mode).toBe('morning');

      // Check tab resolution
      const tab = resolveDefaultTabForMode(mode);
      expect(tab).toBe(1);

      // Check status
      const status = getMeetingStatus(morningTime);
      expect(status.status).toBe('morning-active');
    });

    it('should handle mode transitions correctly', () => {
      let currentMode: MeetingMode = null;

      // Switch to morning tab
      currentMode = resolveTabToModeMapping(1, currentMode);
      expect(currentMode).toBe('morning');

      // Switch to evening tab
      currentMode = resolveTabToModeMapping(2, currentMode);
      expect(currentMode).toBe('evening');

      // Switch back to dashboard
      currentMode = resolveTabToModeMapping(0, currentMode);
      expect(currentMode).toBe(null);
    });
  });
});