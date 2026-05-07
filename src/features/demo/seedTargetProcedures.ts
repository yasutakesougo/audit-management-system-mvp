import { bridgePlanningSheetToDailyProcedures } from '@/features/planning-sheet/logic/dailyProcedureMapper';
import { KATSURAGAWA_SEVERE_SUPPORT_SHEET } from '@/features/planning-sheet/logic/__fixtures__/katsuragawaSevereSupportProcedure';
import { SHIODA_SEVERE_SUPPORT_SHEET } from '@/features/planning-sheet/logic/__fixtures__/shiotaSevereSupportProcedure';
import { ISHIWATA_SEVERE_SUPPORT_SHEET } from '@/features/planning-sheet/logic/__fixtures__/ishiwataSevereSupportProcedure';
import { NAKAMURA_SEVERE_SUPPORT_SHEET } from '@/features/planning-sheet/logic/__fixtures__/nakamuraSevereSupportProcedure';
import type { ProcedureItem } from '@/features/daily/stores/procedureStore';

import type { SupportPlanningSheet } from '@/domain/isp/schema/ispPlanningSheetSchema';

/**
 * 4名の強度行動障害支援対象者の支援手順（17行）をデモ用にシードする。
 * 各自の支援計画シート（Fixtures）からマッピングして生成する。
 */
export function getTargetUserDemoProcedures(): Record<string, ProcedureItem[]> {
  const seeds: Record<string, ProcedureItem[]> = {};

  const mapToStoreItems = (sheet: SupportPlanningSheet): ProcedureItem[] => {
    const doc = bridgePlanningSheetToDailyProcedures(sheet);
    return doc.rows.map(row => ({
      id: `seed-${sheet.userId}-${row.rowNo}`,
      rowNo: row.rowNo,
      time: row.timeLabel,
      activity: row.activity,
      instruction: [row.personAction, row.supporterAction].filter(Boolean).join('。'),
      activityDetail: row.personAction,
      instructionDetail: row.supporterAction,
      isKey: [1, 5, 7, 10, 12, 14, 15].includes(row.rowNo),
      block: row.rowNo <= 5 ? 'morning' : row.rowNo <= 15 ? 'afternoon' : 'outing'
    }));
  };

  seeds['U-001'] = mapToStoreItems(KATSURAGAWA_SEVERE_SUPPORT_SHEET);
  seeds['U-012'] = mapToStoreItems(SHIODA_SEVERE_SUPPORT_SHEET);
  seeds['U-002'] = mapToStoreItems(ISHIWATA_SEVERE_SUPPORT_SHEET);
  seeds['U-006'] = mapToStoreItems(NAKAMURA_SEVERE_SUPPORT_SHEET);

  return seeds;
}
