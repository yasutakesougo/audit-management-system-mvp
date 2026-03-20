/**
 * useUserStatusActions — 利用者状態の登録/更新を統合する共通 Hook
 *
 * 責務:
 *   - Today / Handoff / Schedule 起点の初期値生成
 *   - 既存状態の検索（二重登録防止）
 *   - create / update の自動分岐
 *   - UI 用の状態管理（isSubmitting, error, success）
 *
 * 依存:
 *   - useSchedules (CRUD) — 今日の日付範囲で利用者状態を取得
 *   - domain/userStatus — Pure function 群
 *
 * このフックは SchedulesPort を直接触らず、
 * 既存の useSchedules を介して CRUD を行う。
 *
 * @see Phase 8-A: Today/Handoff からの利用者状態登録
 */

import { useCallback, useMemo, useState } from 'react';

import { toLocalDateISO } from '@/utils/getNow';
import type { SchedItem } from '../data/port';
import {
  type UserStatusRecord,
  type UserStatusSource,
  type UserStatusType,
  findExistingUserStatus,
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
  const targetDate = options.targetDate ?? toLocalDateISO();

  // ─── 1. Fetch today's schedules ───────────────────────────────
  const range = useMemo(() => {
    const from = new Date(`${targetDate}T00:00:00`);
    const to = new Date(`${targetDate}T23:59:59`);
    return makeRange(from, to);
  }, [targetDate]);

  const { items, create, update, refetch } = useSchedules(range);

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
      const existing = findExistingUserStatus(items, userId, targetDate);
      if (!existing) return null;
      return toUserStatusRecord(existing);
    },
    [items, targetDate],
  );

  // ─── 5. Create or Update ──────────────────────────────────────
  const createOrUpdate = useCallback(
    async (input: UserStatusInput): Promise<void> => {
      if (isSubmitting) return;

      setIsSubmitting(true);
      setError(null);
      setSuccessMessage(null);

      const record: UserStatusRecord = {
        userId: input.userId,
        userName: input.userName,
        date: targetDate,
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
          targetDate,
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
            dateIso: targetDate,
            startTime: '00:00',
            endTime: '23:59',
            start: `${targetDate}T00:00:00`,
            end: `${targetDate}T23:59:59`,
            sourceInput: draft,
          };
          await create(inlineDraft);
          setSuccessMessage(
            `${input.userName}を「${label}」として登録しました`,
          );
        }

        // Trigger refetch to sync UI
        refetch();
      } catch (e) {
        const message =
          e instanceof Error ? e.message : '利用者状態の登録に失敗しました';
        setError(message);
        console.error('[useUserStatusActions] createOrUpdate failed', {
          input,
          error: e,
        });
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, targetDate, items, create, update, refetch],
  );

  // ─── 6. Clear helpers ─────────────────────────────────────────
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
