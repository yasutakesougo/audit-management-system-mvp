/**
 * staffAttendanceDateUtils — 日付ユーティリティ
 *
 * StaffAttendanceAdminPage から抽出 (#766)
 */

export function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function firstOfMonthISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
}

export function toISODate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function startOfMonthISO(base: Date): string {
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-01`;
}

export function endOfMonthISO(base: Date): string {
  const d = new Date(base.getFullYear(), base.getMonth() + 1, 0);
  return toISODate(d);
}

export function startOfWeekISO(base: Date): string {
  const d = new Date(base);
  const day = d.getDay();
  const diff = (day + 6) % 7; // 月曜始まり
  d.setDate(d.getDate() - diff);
  return toISODate(d);
}

export function endOfWeekISO(base: Date): string {
  const d = new Date(base);
  const day = d.getDay();
  const diff = 6 - ((day + 6) % 7); // 日曜終わり
  d.setDate(d.getDate() + diff);
  return toISODate(d);
}
