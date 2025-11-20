/**
 * Dashboard Page Core Logic Library
 *
 * All business logic for dashboard operations extracted from DashboardPage.tsx
 * to enable unit testing and maintainability.
 */

export type MeetingMode = 'morning' | 'evening' | null;
export type TabIndex = 0 | 1 | 2 | 3 | 4 | 5;

export interface TimeConfig {
  hours: number;
  minutes: number;
}

/**
 * Resolves initial tab based on meeting mode
 * Used for URL-driven tab selection and mode synchronization
 */
export const resolveDefaultTabForMode = (meetingMode: MeetingMode): TabIndex => {
  if (meetingMode === 'morning') return 1; // ☀ 朝のミーティング
  if (meetingMode === 'evening') return 2; // 🌙 夕方のミーティング
  return 0; // Default dashboard
};

/**
 * Determines current meeting mode based on time of day
 * Critical for auto-switching and time-aware UI behavior
 */
export const getCurrentMeetingMode = (currentTime: Date): MeetingMode => {
  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();

  if ((hours === 8 && minutes >= 50) || (hours === 9 && minutes <= 15)) {
    return 'morning';
  } else if (hours === 17 && minutes >= 10) {
    return 'evening';
  }

  return null; // normal hours
};

/**
 * Generates meeting status indicator
 * Returns both status code and user-friendly message for UI display
 */
export interface MeetingStatus {
  status: 'morning-ready' | 'morning-active' | 'evening-ready' | 'evening-active' | 'normal';
  message: string;
  color: string;
}

export const getMeetingStatus = (currentTime: Date): MeetingStatus => {
  const hours = currentTime.getHours();
  const minutes = currentTime.getMinutes();
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

  if (hours === 8 && minutes >= 50) {
    return { status: 'morning-ready', message: '🕘 朝会開始まで あと数分', color: 'success.main' };
  } else if (hours === 9 && minutes <= 15) {
    return { status: 'morning-active', message: '🔥 朝会進行中', color: 'primary.main' };
  } else if (hours === 17 && minutes >= 15) {
    return { status: 'evening-active', message: '🌅 夕会進行中', color: 'secondary.main' };
  } else if (hours === 17 && minutes >= 10 && minutes < 15) {
    return { status: 'evening-ready', message: '🕐 夕会開始まで あと数分', color: 'warning.main' };
  }

  return { status: 'normal', message: timeStr, color: 'text.secondary' };
};

/**
 * Meeting Mode validation
 * Ensures type safety for meeting mode parameters
 */
export const isValidMeetingMode = (mode: string | null): mode is MeetingMode => {
  return mode === null || mode === 'morning' || mode === 'evening';
};

/**
 * Tab change logic for mode synchronization
 * Handles automatic mode switching when tabs are changed
 */
export const resolveTabToModeMapping = (tabIndex: number, currentMode: MeetingMode): MeetingMode => {
  if (tabIndex === 1 && currentMode !== 'morning') {
    return 'morning'; // 朝ミーティングタブ選択時
  } else if (tabIndex === 2 && currentMode !== 'evening') {
    return 'evening'; // 夕ミーティングタブ選択時
  } else if (tabIndex !== 1 && tabIndex !== 2 && currentMode) {
    return null; // その他のタブ選択時はモード解除
  }

  return currentMode; // 変更なし
};

/**
 * Progress calculation utility
 * Used across multiple Dashboard components for completion rates
 */
export const calculateProgressRate = (completed: number, total: number): number => {
  return total > 0 ? Math.round((completed / total) * 100) : 0;
};

/**
 * Keyboard shortcut handler mapping
 * Centralizes all Dashboard keyboard navigation logic
 */
export interface KeyboardAction {
  key: string;
  altKey?: boolean;
  action: 'navigate' | 'toggle' | 'print';
  target?: string;
}

export const DASHBOARD_KEYBOARD_SHORTCUTS: KeyboardAction[] = [
  { key: 'n', altKey: true, action: 'navigate', target: 'notifications' },
  { key: 's', altKey: true, action: 'navigate', target: 'search' },
  { key: 'm', altKey: true, action: 'toggle', target: 'morning-mode' },
  { key: 'e', altKey: true, action: 'toggle', target: 'evening-mode' },
  { key: 'p', altKey: true, action: 'print' },
];

/**
 * Validates keyboard event against Dashboard shortcuts
 */
export const matchKeyboardShortcut = (event: KeyboardEvent): KeyboardAction | null => {
  return DASHBOARD_KEYBOARD_SHORTCUTS.find(shortcut =>
    shortcut.key === event.key.toLowerCase() &&
    !!shortcut.altKey === event.altKey
  ) || null;
};