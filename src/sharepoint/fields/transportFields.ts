/**
 * SharePoint フィールド定義 — Transport_Log
 *
 * 送迎ステータスのリアルタイムログを記録するリスト。
 * 全状態遷移を保持し、監査証跡として機能する。
 *
 * Title (複合キー): {UserCode}_{RecordDate}_{Direction}
 *   例: U001_2026-03-13_to
 *
 * Sync ルール (AttendanceDaily への確定値同期):
 *   - status=arrived かつ method=facility-vehicle → TransportTo/From = true
 *   - status=self / family / walk              → TransportTo/From = false, Method のみ記録
 *   - status=absent                            → sync しない (attendance 側に委譲)
 */

// ──────────────────────────────────────────────────────────────
// Transport Log (SharePoint list: Transport_Log)
// ──────────────────────────────────────────────────────────────

export const TRANSPORT_LOG_LIST_TITLE = 'Transport_Log' as const;

export const TRANSPORT_LOG_FIELDS = {
  id: 'Id',
  title: 'Title',           // composite key: {UserCode}_{Date}_{Direction}
  userCode: 'UserCode',
  recordDate: 'RecordDate',
  direction: 'Direction',   // Choice: to | from
  status: 'Status',         // Choice: pending | in-progress | arrived | absent | self
  method: 'Method',         // Choice: facility-vehicle | family | taxi | walk | self | other
  scheduledTime: 'ScheduledTime',   // HH:mm
  actualTime: 'ActualTime',         // HH:mm
  driverName: 'DriverName',
  notes: 'Notes',
  updatedBy: 'UpdatedBy',
  updatedAt: 'UpdatedAt',
} as const;

export const TRANSPORT_LOG_SELECT_FIELDS = [
  TRANSPORT_LOG_FIELDS.id,
  TRANSPORT_LOG_FIELDS.title,
  TRANSPORT_LOG_FIELDS.userCode,
  TRANSPORT_LOG_FIELDS.recordDate,
  TRANSPORT_LOG_FIELDS.direction,
  TRANSPORT_LOG_FIELDS.status,
  TRANSPORT_LOG_FIELDS.method,
  TRANSPORT_LOG_FIELDS.scheduledTime,
  TRANSPORT_LOG_FIELDS.actualTime,
  TRANSPORT_LOG_FIELDS.driverName,
  TRANSPORT_LOG_FIELDS.notes,
  TRANSPORT_LOG_FIELDS.updatedBy,
  TRANSPORT_LOG_FIELDS.updatedAt,
] as const;

// ──────────────────────────────────────────────────────────────
// Title key builder
// ──────────────────────────────────────────────────────────────

/** Build the composite Title key for a transport log entry */
export function buildTransportLogTitle(
  userCode: string,
  recordDate: string,
  direction: 'to' | 'from',
): string {
  return `${userCode}_${recordDate}_${direction}`;
}
