/**
 * useApprovalFlow — 承認フローの状態管理 Hook
 *
 * Responsibilities:
 * - 承認モーダルの開閉状態
 * - Repository 経由の承認実行
 * - ローディング/エラー状態管理
 *
 * @see docs/adr/ADR-002-today-execution-layer-guardrails.md
 */
import { useDailyRecordRepository } from '@/features/daily/repositories/repositoryFactory';
import { useStaffStore } from '@/features/staff';
import { toLocalDateISO } from '@/utils/getNow';
import { useCallback, useState } from 'react';

export type ApprovalFlowState = {
  /** モーダル表示状態 */
  isOpen: boolean;
  /** 承認処理中フラグ */
  isApproving: boolean;
  /** エラーメッセージ (null = エラーなし) */
  error: string | null;
  /** 承認対象の日付 (YYYY-MM-DD) */
  targetDate: string;
};

export type ApprovalFlowActions = {
  /** 承認モーダルを開く */
  open: () => void;
  /** 承認モーダルを閉じる (エラーもクリア) */
  close: () => void;
  /** 承認を実行 */
  approve: () => Promise<boolean>;
};

export type UseApprovalFlowReturn = ApprovalFlowState & ApprovalFlowActions;

export function useApprovalFlow(): UseApprovalFlowReturn {
  const repository = useDailyRecordRepository();
  const { staff } = useStaffStore();
  const today = toLocalDateISO();

  // 現在のスタッフ（最初のスタッフを使用）
  const currentStaff = staff.length > 0 ? staff[0] : null;

  const [isOpen, setIsOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useCallback(() => {
    setError(null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setError(null);
  }, []);

  const approve = useCallback(async (): Promise<boolean> => {
    setIsApproving(true);
    setError(null);

    try {
      await repository.approve({
        date: today,
        approverName: currentStaff?.name ?? '不明',
        approverRole: currentStaff?.role ?? '不明',
      });

      setIsOpen(false);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : '承認処理に失敗しました';
      setError(message);
      return false;
    } finally {
      setIsApproving(false);
    }
  }, [repository, today, currentStaff]);

  return {
    isOpen,
    isApproving,
    error,
    targetDate: today,
    open,
    close,
    approve,
  };
}
