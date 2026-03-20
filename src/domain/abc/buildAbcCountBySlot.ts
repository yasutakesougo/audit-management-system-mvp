/**
 * buildAbcCountBySlot — スロット別 ABC 件数集計
 *
 * sourceContext を持つ ABC レコードを slotId 別にカウントする。
 * 条件: source === 'daily-support' && date 一致 && slotId あり
 *
 * @returns slotId → count のマップ
 */
import type { AbcRecord } from './abcRecord';

export type AbcCountBySlot = Record<string, number>;

export function buildAbcCountBySlot(
  records: AbcRecord[],
  userId: string,
  date: string,
): AbcCountBySlot {
  return records.reduce<AbcCountBySlot>((acc, record) => {
    if (record.userId !== userId) return acc;
    if (record.sourceContext?.source !== 'daily-support') return acc;
    if (record.sourceContext?.date !== date) return acc;
    const slotId = record.sourceContext?.slotId;
    if (!slotId) return acc;
    acc[slotId] = (acc[slotId] ?? 0) + 1;
    return acc;
  }, {});
}

/**
 * filterAbcBySlot — 特定スロットの ABC レコードを抽出
 *
 * userId + date + slotId + source=daily-support で絞り込み。
 * 新しい順（occurredAt 降順）で返す。
 */
export function filterAbcBySlot(
  records: AbcRecord[],
  userId: string,
  date: string,
  slotId: string,
): AbcRecord[] {
  return records
    .filter(r => {
      if (r.userId !== userId) return false;
      if (r.sourceContext?.source !== 'daily-support') return false;
      if (r.sourceContext?.date !== date) return false;
      if (r.sourceContext?.slotId !== slotId) return false;
      return true;
    })
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}
