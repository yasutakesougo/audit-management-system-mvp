/**
 * Bulk Daily Record — Constants, types, and validation
 *
 * Extracted from BulkDailyRecordList.tsx for single-responsibility.
 */

import { type MealAmount } from '../../../../domain/daily/types';

// ─── Types ──────────────────────────────────────────────────────────────────

export type BulkRowStatus = 'idle' | 'saved' | 'error' | 'pending';

export type BulkDailyRow = {
  userId: string;
  userName: string;
  mealAmount: MealAmount;
  amNotes: string;
  pmNotes: string;
  specialNotes: string;
  hasProblems: boolean;
  hasSeizure: boolean;
  status: BulkRowStatus;
};

// ─── Labels & Options ───────────────────────────────────────────────────────

export const statusLabels: Record<BulkRowStatus, string> = {
  idle: '未保存',
  saved: '保存済み',
  error: 'エラー',
  pending: '保存中',
};

export const mealOptions: { value: MealAmount; label: string }[] = [
  { value: '完食', label: '完食' },
  { value: '多め', label: '多め' },
  { value: '半分', label: '半分' },
  { value: '少なめ', label: '少なめ' },
  { value: 'なし', label: 'なし' },
];

// ─── Validation ─────────────────────────────────────────────────────────────

export const VALIDATION_LIMITS = {
  MAX_TEXT_LENGTH: 500,
  MAX_NOTES_LENGTH: 200,
} as const;

export const validateRowData = (row: BulkDailyRow): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (row.amNotes.length > VALIDATION_LIMITS.MAX_NOTES_LENGTH) {
    errors.push(`午前記録は${VALIDATION_LIMITS.MAX_NOTES_LENGTH}文字以内で入力してください`);
  }

  if (row.pmNotes.length > VALIDATION_LIMITS.MAX_NOTES_LENGTH) {
    errors.push(`午後記録は${VALIDATION_LIMITS.MAX_NOTES_LENGTH}文字以内で入力してください`);
  }

  if (row.specialNotes.length > VALIDATION_LIMITS.MAX_TEXT_LENGTH) {
    errors.push(`特記事項は${VALIDATION_LIMITS.MAX_TEXT_LENGTH}文字以内で入力してください`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

// ─── Mock Data ──────────────────────────────────────────────────────────────

const mockUsers = [
  { UserID: '001', FullName: '田中太郎' },
  { UserID: '002', FullName: '佐藤花子' },
  { UserID: '003', FullName: '鈴木次郎' },
  { UserID: '004', FullName: '高橋美咲' },
  { UserID: '005', FullName: '山田健一' },
  { UserID: '006', FullName: '渡辺由美' },
  { UserID: '007', FullName: '伊藤雄介' },
  { UserID: '008', FullName: '中村恵子' },
  { UserID: '009', FullName: '小林智子' },
  { UserID: '010', FullName: '加藤秀樹' },
  { UserID: '011', FullName: '吉田京子' },
  { UserID: '012', FullName: '清水達也' },
  { UserID: '013', FullName: '松本麻衣' },
  { UserID: '014', FullName: '森田健二' },
  { UserID: '015', FullName: '池田理恵' },
  { UserID: '016', FullName: '石井大輔' },
];

export const createInitialRows = (): BulkDailyRow[] =>
  mockUsers.map((user) => ({
    userId: user.UserID,
    userName: user.FullName,
    mealAmount: '完食',
    amNotes: '',
    pmNotes: '',
    specialNotes: '',
    hasProblems: false,
    hasSeizure: false,
    status: 'idle',
  }));
