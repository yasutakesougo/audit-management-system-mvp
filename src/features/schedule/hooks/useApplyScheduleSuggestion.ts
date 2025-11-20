import { update as updateScheduleAdapter } from '@/adapters/schedules';
import { useCallback, useMemo } from 'react';
import type { ScheduleEvent } from '../api/schedulesClient';
import type { SuggestionAction } from '../components/ScheduleConflictGuideDialog';
import { detectScheduleConflicts } from '../conflictChecker';
import type { BaseSchedule, Category, Schedule } from '../types';

// adapters/schedules の Schedule型に合わせる
interface AdapterSchedule {
  id: string;
  assignee: string;
  title: string;
  note?: string;
  start: string;
  end: string;
  status: 'planned' | 'confirmed' | 'absent' | 'holiday';
}

// SuggestionAction を adapters/schedules の update に適用可能な形に変換
function mapSuggestionActionToSchedulePatch(action: SuggestionAction): Partial<AdapterSchedule> {
  // 時間調整の場合
  if (action.actionType === 'time-shift' || action.actionType === 'time-shift-30min-later') {
    if (!action.newStart || !action.newEnd) {
      throw new Error('時間調整には新しい開始時間と終了時間が必要です');
    }
    return {
      start: action.newStart,
      end: action.newEnd,
    };
  }

  // 職員変更の場合
  if (action.actionType === 'staff-reassign') {
    if (!action.newStaffId) {
      throw new Error('職員変更には新しい職員IDが必要です');
    }
    return {
      assignee: action.newStaffId,
    };
  }

  // 車両変更の場合 (Stage 7)
  if (action.actionType === 'vehicle-reassign') {
    if (!action.newVehicleId) {
      throw new Error('車両変更には新しい車両IDが必要です');
    }
    // Note: adapters/schedules が車両IDに対応していない場合の暫定対応
    // 本来はvehicleIdフィールドを追加すべき
    return {
      note: `車両: ${action.newVehicleName} (${action.newVehicleId})`,
    };
  }

  // 部屋変更の場合 (Stage 8)
  if (action.actionType === 'room-reassign') {
    if (!action.newRoomId) {
      throw new Error('部屋変更には新しい部屋IDが必要です');
    }
    // Note: adapters/schedules が部屋IDに対応していない場合の暫定対応
    // 本来はroomIdフィールドを追加すべき
    return {
      note: `部屋: ${action.newRoomName} (${action.newRoomId})`,
    };
  }

  // 設備変更の場合 (Stage 8)
  if (action.actionType === 'equipment-reassign') {
    if (!action.newEquipmentId) {
      throw new Error('設備変更には新しい設備IDが必要です');
    }
    // Note: adapters/schedules が設備IDに対応していない場合の暫定対応
    // 本来はequipmentIdフィールドを追加すべき
    return {
      note: `設備: ${action.newEquipmentName} (${action.newEquipmentId})`,
    };
  }

  return {};
}

// ScheduleEvent を Schedule（新型システム）に変換（衝突チェック用）
function mapScheduleEventToFullSchedule(event: ScheduleEvent): Schedule {
  const baseProps: BaseSchedule = {
    id: String(event.id),
    etag: event.etag || '',
    category: event.category as Category,
    title: event.title,
    start: event.start,
    end: event.end,
    allDay: event.allDay || false,
    status: '申請中' as const,
    location: undefined,
    notes: undefined,
    dayKey: event.dayKey,
  };

  // カテゴリ別の特化フィールドを追加
  switch (event.category) {
    case 'User':
      return {
        ...baseProps,
        category: 'User',
        serviceType: '一時ケア' as const,
        personType: 'Internal' as const,
        staffIds: event.staffIds || [],
        staffNames: event.staffNames,
      };
    case 'Org':
      return {
        ...baseProps,
        category: 'Org',
        subType: '会議' as const,
        audience: undefined,
        resourceId: undefined,
        externalOrgName: undefined,
      };
    case 'Staff':
      return {
        ...baseProps,
        category: 'Staff',
        subType: '会議' as const,
        staffIds: event.staffIds || [],
        staffNames: event.staffNames,
        dayPart: undefined,
      };
    default:
      throw new Error(`Unknown schedule category: ${event.category}`);
  }
}

export interface UseApplyScheduleSuggestionProps {
  // 現在の全スケジュール一覧（衝突チェック用）
  allSchedules: ScheduleEvent[];

  // 成功時のコールバック
  onSuccess?: (message: string) => void;

  // エラー時のコールバック
  onError?: (message: string) => void;

  // データ再取得関数
  onRefresh?: () => void;
}

export interface UseApplyScheduleSuggestionReturn {
  applyScheduleSuggestion: (action: SuggestionAction) => Promise<void>;
  isLoading: boolean;
}

export function useApplyScheduleSuggestion({
  allSchedules,
  onSuccess,
  onError,
  onRefresh,
}: UseApplyScheduleSuggestionProps): UseApplyScheduleSuggestionReturn {
  // Schedule型にマップした現在のスケジュール一覧（衝突チェック用）
  const fullSchedules = useMemo(
    () => allSchedules.map(mapScheduleEventToFullSchedule),
    [allSchedules],
  );

  const applyScheduleSuggestion = useCallback(
    async (action: SuggestionAction) => {
      try {
        // 対象スケジュールを取得
        const originalEvent = allSchedules.find(e => String(e.id) === action.scheduleId);
        if (!originalEvent) {
          onError?.('対象のスケジュールが見つかりません');
          return;
        }

        // アクションタイプ別の事前衝突チェック
        if (action.actionType === 'time-shift' || action.actionType === 'time-shift-30min-later') {
          await handleTimeShiftAction(action, originalEvent);
        } else if (action.actionType === 'staff-reassign') {
          await handleStaffReassignAction(action, originalEvent);
        } else {
          onError?.('不明なアクションタイプです');
          return;
        }

        // STEP3: 実際のAPI更新
        const patch = mapSuggestionActionToSchedulePatch(action);
        await updateScheduleAdapter(action.scheduleId, patch);

        // 成功時の処理
        let successMessage = '予定を調整しました';
        if (action.actionType === 'staff-reassign') {
          successMessage = `担当職員を${action.newStaffName || '新しい職員'}に変更しました`;
        } else if ((action.actionType as string) === 'vehicle-reassign') {
          successMessage = `車両を${action.newVehicleName || '新しい車両'}に変更しました`;
        } else if ((action.actionType as string) === 'room-reassign') {
          successMessage = `部屋を${action.newRoomName || '新しい部屋'}に変更しました`;
        } else if ((action.actionType as string) === 'equipment-reassign') {
          successMessage = `設備を${action.newEquipmentName || '新しい設備'}に変更しました`;
        }
        onSuccess?.(successMessage);
        onRefresh?.();

      } catch (error) {
        console.error('予定調整エラー:', error);
        const errorMessage = error instanceof Error
          ? error.message
          : '予定の調整に失敗しました';
        onError?.(errorMessage);
      }
    },
    [fullSchedules, onSuccess, onError, onRefresh, allSchedules],
  );

  // 時間調整アクションの処理
  const handleTimeShiftAction = useCallback(
    async (action: SuggestionAction, originalEvent: ScheduleEvent) => {
      if (!action.newStart || !action.newEnd) {
        throw new Error('時間調整には新しい開始時間と終了時間が必要です');
      }

      // 調整後のスケジュールで衝突チェック
      const otherSchedules = fullSchedules.filter(s => s.id !== action.scheduleId);
      const adjustedSchedule: Schedule = {
        ...mapScheduleEventToFullSchedule(originalEvent),
        start: action.newStart,
        end: action.newEnd,
      };

      const allSchedulesWithAdjusted = [...otherSchedules, adjustedSchedule];
      const postAdjustmentConflicts = detectScheduleConflicts(allSchedulesWithAdjusted)
        .filter(conflict =>
          conflict.idA === action.scheduleId ||
          conflict.idB === action.scheduleId
        );

      if (postAdjustmentConflicts.length > 0) {
        throw new Error('この時間にずらすと、別の予定と重複します。');
      }
    },
    [fullSchedules],
  );

  // 職員変更アクションの処理
  const handleStaffReassignAction = useCallback(
    async (action: SuggestionAction, originalEvent: ScheduleEvent) => {
      if (!action.newStaffId) {
        throw new Error('職員変更には新しい職員IDが必要です');
      }

      // 新しい職員の同時間帯での重複チェック
      const newStaffConflicts = fullSchedules.filter(schedule => {
        // 職員が関与するスケジュールかチェック
        const isStaffInvolved =
          (schedule.category === 'Staff' && schedule.staffIds?.includes(action.newStaffId!)) ||
          (schedule.category === 'User' && schedule.staffIds?.includes(action.newStaffId!)) ||
          (schedule.category === 'Org' &&
            (schedule as Schedule & { audience?: string[] }).audience?.includes(action.newStaffId!));

        if (!isStaffInvolved) return false;

        // 同時間帯の重複チェック
        const scheduleStart = new Date(schedule.start).getTime();
        const scheduleEnd = new Date(schedule.end).getTime();
        const originalStart = new Date(originalEvent.start).getTime();
        const originalEnd = new Date(originalEvent.end).getTime();

        return scheduleStart < originalEnd && scheduleEnd > originalStart;
      });

      if (newStaffConflicts.length > 0) {
        const conflictTitles = newStaffConflicts.slice(0, 2).map(s => s.title).join('、');
        throw new Error(`${action.newStaffName || '新しい職員'}は同時間帯に別の予定があります：${conflictTitles}`);
      }
    },
    [fullSchedules],
  );

  return {
    applyScheduleSuggestion,
    isLoading: false, // 今は状態管理なし、必要に応じて useState で追加
  };
}