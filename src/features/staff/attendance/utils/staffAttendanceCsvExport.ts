/**
 * staffAttendanceCsvExport — CSV エクスポートヘルパー
 *
 * StaffAttendanceAdminPage から抽出 (#766)
 */
import type { StaffAttendance } from '@/features/staff/attendance/types';

const csvEscape = (v: unknown) => {
  const s = v == null ? '' : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
};

function toCsv(rows: Array<Record<string, unknown>>, headers: Array<[string, string]>) {
  const headerLine = headers.map(([, label]) => csvEscape(label)).join(',');
  const lines = rows.map((r) => headers.map(([key]) => csvEscape(r[key])).join(','));
  // Excel対策: UTF-8 BOM
  return `\ufeff${headerLine}\n${lines.join('\n')}\n`;
}

function downloadTextFile(content: string, filename: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportAttendanceCsv(
  items: StaffAttendance[],
  listDateFrom: string,
  listDateTo: string,
  selectedStaffIds: Set<string>,
  selectedStatuses: Set<string>,
): void {
  const headers: Array<[string, string]> = [
    ['recordDate', '日付'],
    ['staffId', '職員ID'],
    ['status', 'ステータス'],
    ['checkInAt', '出勤時刻'],
    ['checkOutAt', '退勤時刻'],
    ['lateMinutes', '遅刻（分）'],
    ['note', '備考'],
  ];

  const rows = items.map((it) => ({
    recordDate: it.recordDate,
    staffId: it.staffId,
    status: it.status,
    checkInAt: it.checkInAt ?? '',
    checkOutAt: it.checkOutAt ?? '',
    lateMinutes: it.lateMinutes ?? '',
    note: it.note ?? '',
  }));

  const staffSuffix =
    selectedStaffIds.size > 0 ? `_staff-${Array.from(selectedStaffIds).join('-')}` : '';
  const statusSuffix =
    selectedStatuses.size > 0 ? `_status-${Array.from(selectedStatuses).join('-')}` : '';

  const filename = `staff-attendance_${listDateFrom}_${listDateTo}${staffSuffix}${statusSuffix}.csv`;

  const csv = toCsv(rows, headers);
  downloadTextFile(csv, filename);
}
