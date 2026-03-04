/**
 * Transport Status — Type definitions
 *
 * Data model for tracking transport (送迎) status per user per direction.
 * Builds on top of TransportMethod from features/attendance/transportMethod.ts.
 *
 * State Machine:
 *   pending → in-progress → arrived
 *           ↘ absent
 *   self (terminal — no transitions)
 *
 * @see features/attendance/transportMethod.ts — TransportMethod enum & resolution
 */

import type { TransportMethod } from '@/features/attendance/transportMethod';

// ─── Transport Leg Status (State Machine) ───────────────────────────────────

/**
 * Status of a single transport leg (1 user × 1 direction).
 *
 * - pending:     送迎予定あり・未出発
 * - in-progress: 移動中（ドライバー出発済み）
 * - arrived:     到着済み
 * - absent:      欠席（送迎キャンセル）
 * - self:        自力通所（送迎対象外）
 */
export type TransportLegStatus =
  | 'pending'
  | 'in-progress'
  | 'arrived'
  | 'absent'
  | 'self';

/** Allowed state transitions */
export const TRANSPORT_TRANSITIONS: Record<TransportLegStatus, readonly TransportLegStatus[]> = {
  'pending':     ['in-progress', 'absent'] as const,
  'in-progress': ['arrived'] as const,
  'arrived':     [] as const,
  'absent':      [] as const,
  'self':        [] as const,
};

/** Whether a status represents a "terminal" (no further action) state */
export function isTerminalStatus(status: TransportLegStatus): boolean {
  return TRANSPORT_TRANSITIONS[status].length === 0;
}

// ─── Transport Leg ──────────────────────────────────────────────────────────

/**
 * Represents one user's transport in one direction (往路 or 復路).
 */
export type TransportLeg = {
  userId: string;
  userName: string;
  direction: 'to' | 'from';
  method: TransportMethod;
  status: TransportLegStatus;
  scheduledTime?: string;   // HH:mm
  actualTime?: string;      // HH:mm (on arrival)
  driverName?: string;
  notes?: string;
};

// ─── Direction config ───────────────────────────────────────────────────────

export type TransportDirection = 'to' | 'from';

export const DIRECTION_LABEL: Record<TransportDirection, string> = {
  to: '往路（行き）',
  from: '復路（帰り）',
};

export const DIRECTION_EMOJI: Record<TransportDirection, string> = {
  to: '🔵',
  from: '🟢',
};

/** Hour (0-23) after which default tab switches to 'from' */
export const AUTO_SWITCH_HOUR = 13;

// ─── Status display config ──────────────────────────────────────────────────

export const STATUS_LABEL: Record<TransportLegStatus, string> = {
  'pending':     '待機中',
  'in-progress': '移動中',
  'arrived':     '到着済み',
  'absent':      '欠席',
  'self':        '自力通所',
};

export const STATUS_COLOR: Record<TransportLegStatus, string> = {
  'pending':     '#2196F3',  // blue
  'in-progress': '#FF9800',  // amber
  'arrived':     '#4CAF50',  // green
  'absent':      '#F44336',  // red
  'self':        '#9E9E9E',  // grey
};

// ─── Aggregate summary ──────────────────────────────────────────────────────

/** Summary stats for one direction (to or from) */
export type TransportDirectionSummary = {
  direction: TransportDirection;
  total: number;           // 全送迎対象者（self除く）
  arrived: number;
  inProgress: number;
  pending: number;
  absent: number;
  selfCount: number;       // 自力通所者（参考値・カード分離表示用）
  /** 予定時刻を5分以上超過している Leg のID */
  overdueUserIds: string[];
};

/** Full transport status for today */
export type TodayTransportStatus = {
  to: TransportDirectionSummary;
  from: TransportDirectionSummary;
  legs: TransportLeg[];
};
