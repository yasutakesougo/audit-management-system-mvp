import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { emitDailySubmissionEvents } from '@/features/ibd/analysis/pdca/dailyMetricsAdapter';
import { saveLastActivities } from '../legacy/useLastActivities';
import type { DailyRecordRepository } from '../../domain/legacy/DailyRecordRepository';
import type {
  TableDailyRecordData,
  TableDailyRecordValidationErrors,
} from '../view-models/useTableDailyRecordForm'; // TODO: Move types later if needed

type UseTableDailyRecordSaveOrchestratorParams = {
  /** フォーム全体のデータ状態 */
  formData: TableDailyRecordData;
  /** 選択された利用者のIDリスト */
  selectedUserIds: string[];
  /** DB通信インターフェース */
  repository: DailyRecordRepository;
  /** 下書きが保存された日時（PDCAトラッキング用） */
  draftSavedAt: string | null;
  /** 保存成功時のコールバック（画面遷移や初期化など） */
  onSuccess: () => void;
  /** スナップショット（下書き）の破棄関数 */
  clearDraft: () => void;
};

/** YYYY-MM-DD 形式の日付バリデーション */
const isValidDate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value);
  return !isNaN(d.getTime());
};

/**
 * フォームデータのバリデーション
 * @returns エラーオブジェクト（空 = エラーなし）
 */
export const validateFormData = (
  formData: TableDailyRecordData,
  selectedUserIds: string[],
): TableDailyRecordValidationErrors => {
  const errors: TableDailyRecordValidationErrors = {};

  if (!formData.date.trim()) {
    errors.date = '日付を入力してください';
  } else if (!isValidDate(formData.date)) {
    errors.date = '有効な日付を入力してください（例: 2026-03-03）';
  }

  if (!formData.reporter.name.trim()) {
    errors.reporterName = '記録者名を入力してください';
  }

  if (selectedUserIds.length === 0) {
    errors.selectedUsers = '利用者を1人以上選択してください';
  }

  return errors;
};

/**
 * 【PR 3-A】保存導線の Orchestrator
 * UI層(React State)から副作用(Repository Save/Toast/Draft Clear/Navigation)の束ねを請け負い、
 * 業務フローの「実行(Execution)」をカプセル化する。
 */
export function useTableDailyRecordSaveOrchestrator({
  formData,
  selectedUserIds,
  repository,
  draftSavedAt,
  onSuccess,
  clearDraft,
}: UseTableDailyRecordSaveOrchestratorParams) {
  const [saving, setSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<TableDailyRecordValidationErrors>({});

  const clearValidationErrors = useCallback(() => setValidationErrors({}), []);

  const handleSave = useCallback(async () => {
    // 1. バリデーション実行
    const errors = validateFormData(formData, selectedUserIds);
    setValidationErrors(errors);

    if (Object.keys(errors).length > 0) {
      const firstError = Object.values(errors)[0];
      const errorMessage = typeof firstError === 'string'
        ? firstError
        : '入力内容にエラーがあります';
      toast.error(errorMessage, { duration: 4000 });
      return;
    }

    setSaving(true);
    try {
      // 2. Repository（保存）呼び出し
      await repository.save(formData);

      // 3. PDCA トラッキング (IBD Metrics / Telemetry)
      const submittedAt = new Date().toISOString();
      const submissionEvents = selectedUserIds.map((userId) => ({
        userId,
        recordDate: formData.date,
        submittedAt,
        draftCreatedAt: draftSavedAt ?? undefined,
      }));
      emitDailySubmissionEvents(submissionEvents);

      // 4. 前回の午前・午後活動を保存（次回のプリフィル用）
      saveLastActivities(formData.userRows);
      
      // 5. 成功時：下書き削除と画面遷移
      clearDraft();
      
      toast.success(
        `${selectedUserIds.length}人分の活動記録を保存しました`,
        { duration: 3000 },
      );
      
      onSuccess();
    } catch (error) {
      // 6. 失敗時：エラーハンドリング
      console.error('[useTableDailyRecordSaveOrchestrator] 保存に失敗しました:', error);
      toast.error('保存に失敗しました。もう一度お試しください。', { duration: 5000 });
    } finally {
      setSaving(false);
    }
  }, [formData, selectedUserIds, repository, draftSavedAt, clearDraft, onSuccess]);

  return {
    handleSave,
    saving,
    validationErrors,
    clearValidationErrors,
  };
}
