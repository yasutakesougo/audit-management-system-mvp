/**
 * IRC Calendar — Types, pure logic, and utility functions
 *
 * Extracted from IntegratedResourceCalendarPage.tsx for testability
 * and single-responsibility. All functions are pure (no React state).
 */

import { isE2E } from '@/env';
import type { DateSpanApi, EventInput } from '@fullcalendar/core';
import type {
    PvsAStatus,
    UnifiedResourceEvent,
} from '../features/resources/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ResourceWarning = {
  totalHours: number;
  isOver: boolean;
};

export type EventAllowInfo = {
  start: Date | null;
  end: Date | null;
  resource?: { id?: string };
  id?: string;
};
export type SelectAllowInfo = DateSpanApi & { resource?: { id?: string } };
export type CalendarExtendedProps = UnifiedResourceEvent['extendedProps'] & { resourceId?: string };

export type SimpleResourceEvent = {
  id: string;
  resourceId: string;
  start: Date;
  end: Date;
  display?: string;
  hasActual: boolean;
};

export type MoveWindow = {
  resourceId: string;
  start: Date;
  end: Date;
};

export type MoveDecisionReason = 'locked' | 'overlap';

export type MoveDecision = { allowed: true } | { allowed: false; reason: MoveDecisionReason };

export type SelectDecisionReason = 'no-resource' | 'overlap';

export type SelectDecision = { allowed: true } | { allowed: false; reason: SelectDecisionReason };

// ─── Pure Logic (tested in IntegratedResourceCalendar.logic.spec.ts) ────────

/**
 * ドラッグ＆リサイズ時のロジック判定（実績ロック + ダブルブッキング禁止）
 */
export function evaluateMoveEvent(
  window: MoveWindow,
  dragged: SimpleResourceEvent,
  allEvents: SimpleResourceEvent[],
): MoveDecision {
  if (dragged.hasActual) {
    return { allowed: false, reason: 'locked' };
  }

  const hasOverlap = allEvents.some((event) => {
    if (event.id === dragged.id) return false;
    if (event.display === 'background') return false;
    if (event.resourceId !== window.resourceId) return false;
    return window.start < event.end && window.end > event.start;
  });

  if (hasOverlap) {
    return { allowed: false, reason: 'overlap' };
  }

  return { allowed: true };
}

/**
 * ドラッグ選択での新規作成ロジック（ダブルブッキング禁止）
 */
export function evaluateSelectEvent(
  window: MoveWindow,
  allEvents: SimpleResourceEvent[],
): SelectDecision {
  if (!window.resourceId) {
    return { allowed: false, reason: 'no-resource' };
  }

  const hasOverlap = allEvents.some((event) => {
    if (event.display === 'background') return false;
    if (event.resourceId !== window.resourceId) return false;
    return window.start < event.end && window.end > event.start;
  });

  if (hasOverlap) {
    return { allowed: false, reason: 'overlap' };
  }

  return { allowed: true };
}

// ─── Warning Events ─────────────────────────────────────────────────────────

/**
 * Issue 9: 背景警告イベント（キャパシティ超過警告）
 */
export const fetchWarningEvents = (
  fetchInfo: { startStr: string; endStr: string },
  successCallback: (events: EventInput[]) => void,
  failureCallback: (error: Error) => void,
) => {
  try {
    if (isE2E) {
      successCallback([]);
      return;
    }

    const startDateStr = fetchInfo.startStr.slice(0, 10);

    const warnings: EventInput[] = [
      {
        id: 'warn-staff-1',
        resourceId: 'staff-1',
        start: `${startDateStr}T09:00:00`,
        end: `${startDateStr}T18:00:00`,
        title: 'キャパシティ超過の可能性',
      },
    ];

    successCallback(warnings);
  } catch (error) {
    if (error instanceof Error) {
      failureCallback(error);
      return;
    }
    failureCallback(new Error('Failed to load warning events'));
  }
};

// ─── Utility Functions ──────────────────────────────────────────────────────

/**
 * PvsAステータスアイコン
 */
export const getStatusIcon = (status?: PvsAStatus): string => {
  switch (status) {
    case 'waiting': return '⏳';
    case 'in-progress': return '🔄';
    case 'completed': return '✅';
    case 'delayed': return '⚠️';
    case 'cancelled': return '❌';
    default: return '📅';
  }
};

/**
 * 時刻フォーマット (HH:MM)
 */
export const formatTime = (isoString: string): string => {
  return new Date(isoString).toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * 動的イベントクラス付与
 */
export const getDynamicEventClasses = (arg: { event: { extendedProps: Record<string, unknown> } }): string[] => {
  const event = arg.event;
  const props = event.extendedProps as UnifiedResourceEvent['extendedProps'];
  const { planType, status } = props;

  const classes = ['unified-event'];

  if (planType) {
    classes.push(`event-type-${planType}`);
  }

  if (status) {
    classes.push(`event-status-${status}`);
  }

  return classes;
};
