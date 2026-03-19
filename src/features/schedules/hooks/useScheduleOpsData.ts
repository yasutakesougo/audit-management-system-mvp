/**
 * useScheduleOpsData — スケジュールデータの取得と CRUD
 *
 * 責務:
 * - 既存 useSchedules を用いて基盤データ(rawItems)を取得
 * - rawItems を ScheduleOpsItem[] として型アサートし提供する
 * - Phase 1 では読み書きの基盤となる error / loading を返す
 */

import { useMemo } from 'react';

import type { ScheduleOpsItem } from '../domain/scheduleOpsSchema';
import { type DateRange, useSchedules } from './useSchedules';

export type ScheduleOpsDataReturn = {
  rawItems: ScheduleOpsItem[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
};

export const useScheduleOpsData = (range: DateRange): ScheduleOpsDataReturn => {
  const { items, loading, lastError, refetch } = useSchedules(range);

  // OpsSchema 対応の Item 配列として扱う（未知の拡張フィールドも保持）
  const rawItems = useMemo(
    () => items as unknown as ScheduleOpsItem[],
    [items]
  );

  return {
    rawItems,
    isLoading: loading,
    error: lastError?.message ?? null,
    refetch,
  };
};
