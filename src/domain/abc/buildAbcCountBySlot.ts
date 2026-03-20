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
