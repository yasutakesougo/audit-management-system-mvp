/**
 * useUserStatusActions — 利用者状態の登録/更新を統合する共通 Hook
 *
 * 責務:
 *   - Today / Handoff / Schedule 起点の初期値生成
 *   - 既存状態の検索（二重登録防止）
 *   - create / update の自動分岐
 *   - UI 用の状態管理（isSubmitting, error, success）
 *   - 欠席/事前欠席の場合は Attendance リストにも同期書き込み
 *
 * 依存:
 *   - useSchedules (CRUD) — 今日の日付範囲で利用者状態を取得
 *   - domain/userStatus — Pure function 群
 *   - AttendanceRepository — Attendance 書き込み (B1 統合)
 *
 * このフックは SchedulesPort を直接触らず、
 * 既存の useSchedules を介して Schedule CRUD を行う。
 * Attendance への書き込みは AttendanceRepository.upsertDailyByKey を使用。
 *
 * @see Phase 8-A: Today/Handoff からの利用者状態登録
 */

import { useCallback, useMemo, useState } from 'react';

import { toLocalDateISO } from '@/utils/getNow';
import { useAttendanceRepository } from '@/features/attendance/repositoryFactory';
import {
  isSchedulesConflictError,
  resolveOperationFailureFeedback,
} from '@/features/today/feedback/operationFeedback';
import type { AttendanceDailyItem } from '@/features/attendance/infra/attendanceDailyRepository';
import type { SchedItem } from '../data/port';
import {
  type UserStatusRecord,
  type UserStatusSource,
  type UserStatusType,
  findExistingUserStatus,
  toAttendanceStatus,
  toScheduleDraft,
  toUserStatusRecord,
  USER_STATUS_LABELS,
} from '../domain/userStatus';
import { makeRange, useSchedules } from './useSchedules';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/** Hook の初期化オプション */
export type UseUserStatusActionsOptions = {
  /** 対象日（デフォルト: 今日） */
  targetDate?: string;
};

/** 登録/更新に必要な入力 */
export type UserStatusInput = {
  userId: string;
  userName: string;
  statusType: UserStatusType;
  source: UserStatusSource;
  note?: string;
  time?: string;
  handoffId?: number;
  /** 対象日 (YYYY-MM-DD) — 省略時は今日 */
  targetDate?: string;
};

/** Hook の返り値 */
export type UseUserStatusActionsReturn = {
  /** 利用者状態を登録/更新する。既存があれば update、なければ create。 */
  createOrUpdate: (input: UserStatusInput) => Promise<void>;
  /** 指定利用者の当日ステータスを検索 */
  findExisting: (userId: string) => UserStatusRecord | null;
  /** 当日の全利用者状態レコード */
  todayStatusRecords: UserStatusRecord[];
  /** 送信中フラグ */
  isSubmitting: boolean;
  /** 最後のエラーメッセージ */
  error: string | null;
  /** 最後の成功メッセージ */
  successMessage: string | null;
  /** 成功メッセージをクリア */
  clearSuccess: () => void;
  /** エラーをクリア */
  clearError: () => void;
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Hook
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function useUserStatusActions(
  options: UseUserStatusActionsOptions = {},
): UseUserStatusActionsReturn {
  const defaultDate = options.targetDate ?? toLocalDateISO();
  const conflictFeedback = resolveOperationFailureFeedback('schedules:conflict-412');

  // ─── 1. Fetch today's schedules ───────────────────────────────
  const range = useMemo(() => {
    const from = new Date(`${defaultDate}T00:00:00`);
    const to = new Date(`${defaultDate}T23:59:59`);
    return makeRange(from, to);
  }, [defaultDate]);

  const { items, create, update, refetch } = useSchedules(range);

  // ─── 1.5. Attendance repository (B1: 欠席同期) ───────────────
  const attendanceRepo = useAttendanceRepository();

  // ─── 2. Extract today's user status records ───────────────────
  const todayStatusRecords = useMemo(() => {
    const records: UserStatusRecord[] = [];
    for (const item of items) {
      const record = toUserStatusRecord(item);
      if (record) records.push(record);
    }
    return records;
  }, [items]);

  // ─── 3. Local state ───────────────────────────────────────────
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ─── 4. Find existing status for a user ───────────────────────
  const findExisting = useCallback(
    (userId: string): UserStatusRecord | null => {
      const existing = findExistingUserStatus(items, userId, defaultDate);
      if (!existing) return null;
      return toUserStatusRecord(existing);
    },
    [items, defaultDate],
  );

  // ─── 5. Sync to Attendance list (B1) ──────────────────────────
  const syncToAttendance = useCallback(
    async (input: UserStatusInput, date: string): Promise<void> => {
      const attendanceStatus = toAttendanceStatus(input.statusType);
      if (!attendanceStatus) return; // 遅刻・早退は Attendance 書き込み不要

      const dailyItem: AttendanceDailyItem = {
        Key: `${input.userId}|${date}`,
        UserCode: input.userId,
        RecordDate: date,
        Status: attendanceStatus,
        CntAttendIn: 0,
        CntAttendOut: 0,
        TransportTo: false,
        TransportFrom: false,
        ProvidedMinutes: 0,
        IsEarlyLeave: false,
        AbsentMorningContacted: input.source === 'today' || input.source === 'handoff',
        AbsentMorningMethod: input.source === 'today' ? '電話' : '',
        EveningChecked: false,
        EveningNote: '',
        IsAbsenceAddonClaimable: false,
        CheckInAt: null,
        CheckOutAt: null,
        UserConfirmedAt: null,
      };

      try {
        await attendanceRepo.upsertDailyByKey(dailyItem);
        console.info('[useUserStatusActions] Synced to Attendance:', {
          userId: input.userId,
          status: attendanceStatus,
          date,
        });
      } catch (e) {
        // Attendance 書き込み失敗は Schedule 登録自体を失敗にしない（ベストエフォート）
        console.warn('[useUserStatusActions] Attendance sync failed (non-fatal):', e);
      }
    },
    [attendanceRepo],
  );

  // ─── 6. Create or Update ──────────────────────────────────────
  const createOrUpdate = useCallback(
    async (input: UserStatusInput): Promise<void> => {
      if (isSubmitting) return;

      const date = input.targetDate ?? defaultDate;

      setIsSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      const record: UserStatusRecord = {
        userId: input.userId,
        userName: input.userName,
        date,
        statusType: input.statusType,
        source: input.source,
        note: input.note,
        time: input.time,
        handoffId: input.handoffId,
      };

      const draft = toScheduleDraft(record);
      const label = USER_STATUS_LABELS[input.statusType];

      try {
        // Check for existing status (same user, same day)
        const existingItem = findExistingUserStatus(
          items,
          input.userId,
          date,
        ) as SchedItem | undefined;

        if (existingItem) {
          // Update existing
          await update({
            id: existingItem.id,
            etag: existingItem.etag,
            ...draft,
          });
          setSuccessMessage(
            `${input.userName}の状態を「${label}」に更新しました`,
          );
        } else {
          // Create new
          const inlineDraft = {
            title: draft.title,
            dateIso: date,
            startTime: '00:00',
            endTime: '23:59',
            start: `${date}T00:00:00`,
            end: `${date}T23:59:59`,
            sourceInput: draft,
          };
          await create(inlineDraft);
          setSuccessMessage(
            `${input.userName}を「${label}」として登録しました`,
          );
        }

        // B1: Sync to Attendance list (absence/preAbsence only)
        await syncToAttendance(input, date);

        // Trigger refetch to sync UI
        refetch();
      } catch (e) {
        const message = isSchedulesConflictError(e)
          ? conflictFeedback.userMessage
          : e instanceof Error
            ? e.message
            : '利用者状態の登録に失敗しました';
        setError(message);
        console.error('[useUserStatusActions] createOrUpdate failed', {
          input,
          error: e,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, defaultDate, items, create, update, refetch, syncToAttendance, conflictFeedback],
  );

  // ─── 7. Clear helpers ─────────────────────────────────────────
  const clearSuccess = useCallback(() => setSuccessMessage(null), []);
  const clearError = useCallback(() => setError(null), []);

  return {
    createOrUpdate,
    findExisting,
    todayStatusRecords,
    isSubmitting,
    error,
    successMessage,
    clearSuccess,
    clearError,
  };
}
