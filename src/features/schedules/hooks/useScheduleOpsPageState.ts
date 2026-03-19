/**
 * useScheduleOpsPageState — OpsSchedulePage の画面内 UI状態（Date, ViewMode, Drawer 等）
 *
 * 責務:
 * - selectedDate の保持と移動 (今日、前日、翌日)
 * - viewMode の保持
 * - selectedItem (ドロワー用) の保持
 *
 * TODO: Date param のクエリ同期を将来するならここで対応可能だが、Phase 1 では内部状態とする
 */

import { addDays, startOfDay } from 'date-fns';
import { useCallback, useState } from 'react';

import type { OpsViewMode } from '../domain/scheduleOps';
import type { ScheduleOpsItem } from '../domain/scheduleOpsSchema';

export type ScheduleOpsPageStateReturn = {
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  goToday: () => void;
  goPrev: () => void;
  goNext: () => void;
  viewMode: OpsViewMode;
  setViewMode: (mode: OpsViewMode) => void;
  selectedItem: ScheduleOpsItem | null;
  selectItem: (item: ScheduleOpsItem | null) => void;
  detailOpen: boolean;
};

export const useScheduleOpsPageState = (
  initialDate: Date = startOfDay(new Date()),
): ScheduleOpsPageStateReturn => {
  const [selectedDate, setSelectedDate] = useState<Date>(initialDate);
  const [viewMode, setViewMode] = useState<OpsViewMode>('daily');
  const [selectedItem, setSelectedItem] = useState<ScheduleOpsItem | null>(null);

  const goToday = useCallback(() => {
    setSelectedDate(startOfDay(new Date()));
  }, []);

  const goPrev = useCallback(() => {
    setSelectedDate((prev) => addDays(prev, -1));
  }, []);

  const goNext = useCallback(() => {
    setSelectedDate((prev) => addDays(prev, 1));
  }, []);

  const selectItem = useCallback((item: ScheduleOpsItem | null) => {
    setSelectedItem(item);
  }, []);

  return {
    selectedDate,
    setSelectedDate,
    goToday,
    goPrev,
    goNext,
    viewMode,
    setViewMode,
    selectedItem,
    selectItem,
    detailOpen: selectedItem !== null,
  };
};
