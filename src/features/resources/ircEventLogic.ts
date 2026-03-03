/**
 * IRC — Pure business logic functions and domain types.
 *
 * These are side-effect-free and fully unit-testable.
 */
import { isE2E } from '@/env';
import type { EventInput } from '@fullcalendar/core';
import type { PvsAStatus } from './types';

// ── Domain types ───────────────────────────────────────────────────────────

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

export type MoveDecision =
  | { allowed: true }
  | { allowed: false; reason: MoveDecisionReason };

export type SelectDecisionReason = 'no-resource' | 'overlap';

export type SelectDecision =
  | { allowed: true }
  | { allowed: false; reason: SelectDecisionReason };

export type ResourceWarningEntry = {
  totalHours: number;
  isOver: boolean;
};

// ── Pure logic ─────────────────────────────────────────────────────────────

/**
 * ドラッグ＆リサイズの可否判定（実績ロック＋ダブルブッキング禁止）
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
 * 新規作成（ドラッグ選択）の可否判定
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
 * 背景警告イベント（キャパシティ超過警告）
 */
export const fetchWarningEvents = (
  fetchInfo: { startStr: string; endStr: string },
  successCallback: (events: EventInput[]) => void,
  failureCallback: (error: Error) => void,
): void => {
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

/**
 * 動的イベントクラス付与
 */
export const getDynamicEventClasses = (
  arg: { event: { extendedProps: Record<string, unknown> } },
): string[] => {
  const props = arg.event.extendedProps;
  const planType = props.planType as string | undefined;
  const status = props.status as string | undefined;

  const classes = ['unified-event'];
  if (planType) classes.push(`event-type-${planType}`);
  if (status) classes.push(`event-status-${status}`);
  return classes;
};

/** 8時間リミット定数 */
export const WORK_HOUR_LIMIT = 8;
