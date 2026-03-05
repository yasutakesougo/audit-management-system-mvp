/**
 * syncAttendanceToProvision — 通園データ → サービス提供実績へ変換
 *
 * AttendanceRowVM[] を UpsertProvisionInput[] に変換する純粋関数。
 * 通園管理の入退所データを、実績記録票（いそかつ書式）に必要な形式へ変換。
 *
 * マッピングルール:
 *   通所中/退所済 → status: '提供'
 *   当日欠席      → status: '欠席'
 *   未            → スキップ（実績なし）
 *
 *   checkInAt  → startHHMM (JST HH*100+MM)
 *   checkOutAt → endHHMM   (JST HH*100+MM)
 *   transportTo       → hasTransportPickup
 *   transportFrom     → hasTransportDropoff
 *   isAbsenceAddonClaimable → hasAbsentSupport
 */
import type { AttendanceRowVM } from '@/features/attendance/types';
import type { UpsertProvisionInput } from './domain/types';

/**
 * ISO timestamp → HHMM 数値（JST）
 * 例: "2026-03-05T00:30:00Z" → 930 (09:30 JST)
 */
function isoToHHMM(iso: string | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  // JST = UTC + 9
  const jstH = (d.getUTCHours() + 9) % 24;
  const jstM = d.getUTCMinutes();
  return jstH * 100 + jstM;
}

/**
 * AttendanceRowVM[] → UpsertProvisionInput[]
 *
 * @param rows - 通園管理の行データ
 * @param date - 記録日（YYYY-MM-DD）
 * @returns サービス提供実績の入力データ配列
 */
export function convertAttendanceToProvision(
  rows: AttendanceRowVM[],
  date: string,
): UpsertProvisionInput[] {
  const inputs: UpsertProvisionInput[] = [];

  for (const row of rows) {
    // 「未」ステータスはスキップ
    if (row.status === '未') continue;

    const isPresent = row.status === '通所中' || row.status === '退所済';
    const isAbsent = row.status === '当日欠席';

    if (!isPresent && !isAbsent) continue;

    const startHHMM = isPresent ? isoToHHMM(row.checkInAt) : null;
    const endHHMM = isPresent ? isoToHHMM(row.checkOutAt) : null;

    const input: UpsertProvisionInput = {
      userCode: row.userCode,
      recordDateISO: date,
      status: isPresent ? '提供' : '欠席',
      startHHMM,
      endHHMM,
      hasTransport: row.transportTo || row.transportFrom,
      hasTransportPickup: row.transportTo,
      hasTransportDropoff: row.transportFrom,
      hasMeal: undefined,   // 通園管理に食事情報なし → 既存値を保持
      hasBath: undefined,   // 通園管理に入浴情報なし → 既存値を保持
      hasExtended: false,
      hasAbsentSupport: isAbsent ? row.isAbsenceAddonClaimable : false,
      note: isAbsent && row.eveningNote ? row.eveningNote : undefined,
      source: 'Attendance',
    };

    inputs.push(input);
  }

  return inputs;
}
