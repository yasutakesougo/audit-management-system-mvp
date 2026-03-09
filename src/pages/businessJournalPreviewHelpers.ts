/**
 * Business Journal Preview — Types, Constants, and Helpers
 *
 * Pure type definitions, display constants, and helper functions for the
 * business journal preview grid. Extracted from BusinessJournalPreviewPage.tsx.
 *
 * @module pages/businessJournalPreviewHelpers
 */

import type { MealAmount } from '@/domain/daily/types';

// ============================================================================
// Types
// ============================================================================

export type AttendanceStatus = '出席' | '欠席' | '遅刻' | '早退' | '休日';

export interface JournalDayEntry {
  date: string; // YYYY-MM-DD
  attendance: AttendanceStatus;
  mealAmount?: MealAmount;
  amActivities: string[];
  pmActivities: string[];
  restraint?: boolean;
  selfHarm?: boolean;
  otherInjury?: boolean;
  specialNotes?: string;
  hasAttachment?: boolean;
}

export interface JournalUserRow {
  userId: string;
  displayName: string;
  entries: JournalDayEntry[];
}

// ============================================================================
// Display Constants
// ============================================================================

export const ATTENDANCE_COLORS: Record<AttendanceStatus, string> = {
  出席: '#4caf50',
  欠席: '#f44336',
  遅刻: '#ff9800',
  早退: '#ff9800',
  休日: '#9e9e9e',
};

export const MEAL_SHORT: Record<MealAmount, string> = {
  完食: '◎',
  多め: '○',
  半分: '△',
  少なめ: '▽',
  なし: '×',
};

// ============================================================================
// Pure Helpers
// ============================================================================

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * Get day-of-week color for calendar header
 * @returns CSS color string: red for Sunday, blue for Saturday, inherit otherwise
 */
export function getDayColor(year: number, month: number, day: number): string {
  const dow = new Date(year, month - 1, day).getDay();
  if (dow === 0) return '#f44336'; // Sunday
  if (dow === 6) return '#2196f3'; // Saturday
  return 'inherit';
}

/**
 * Get short day-of-week label (日/月/火/水/木/金/土)
 */
export function getDayLabel(year: number, month: number, day: number): string {
  const dow = new Date(year, month - 1, day).getDay();
  return DAY_LABELS[dow];
}

/**
 * Build tooltip lines for a journal cell
 */
export function buildTooltipLines(entry: JournalDayEntry): string[] {
  if (entry.attendance === '休日') return [];
  const lines: string[] = [];
  lines.push(`出欠: ${entry.attendance}`);
  if (entry.mealAmount) lines.push(`食事: ${entry.mealAmount}`);
  if (entry.amActivities.length) lines.push(`AM: ${entry.amActivities.join(', ')}`);
  if (entry.pmActivities.length) lines.push(`PM: ${entry.pmActivities.join(', ')}`);
  if (entry.specialNotes) lines.push(`特記: ${entry.specialNotes}`);
  return lines;
}
