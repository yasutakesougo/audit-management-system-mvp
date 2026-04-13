import { useMemo } from 'react';
import { usePlanningSheetRepositories } from './usePlanningSheetRepositories';
import { usePlanningSheetData } from './usePlanningSheetData';
import { bridgePlanningSheetToDailyProcedures, type BridgeSource } from '../planningToRecordBridge';
import type { ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';

/**
 * 支援計画シートを取得し、Daily サポート用の手順リスト（ScheduleItem[]）に変換する hook。
 * 
 * 戦略:
 * 1. URL 等から渡された planningSheetId がある場合、その実体を取得。
 * 2. 取得中 (isLoading) またはエラー (error) の状態を管理。
 * 3. 取得成功時、計画書の内容を実施手順へ変換して返す。
 * 4. ID 切替時は直ちにデータをクリアし、stale な手順が表示されないことを保証する。
 * 
 * @param planningSheetId 取得対象の支援計画シートID
 * @returns { schedule, isLoading, error, bridgeSource } 変換後の手順と状態
 */
export function usePlanningSheetToProcedureBridge(planningSheetId?: string) {
  const planningRepo = usePlanningSheetRepositories();
  const { data: sheetData, isLoading, error } = usePlanningSheetData(planningSheetId, planningRepo);

  const bridgeResult = useMemo(() => {
    if (!sheetData || !planningSheetId) {
      return { schedule: undefined, source: 'repository_default' as BridgeSource };
    }
    
    const result = bridgePlanningSheetToDailyProcedures(sheetData);
    return {
      schedule: result.steps as ScheduleItem[],
      source: result.source,
    };
  }, [sheetData, planningSheetId]);

  return {
    schedule: bridgeResult.schedule,
    bridgeSource: bridgeResult.source,
    isLoading,
    error,
  };
}
