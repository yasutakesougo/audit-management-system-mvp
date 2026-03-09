/**
 * @fileoverview ウィザード3ステップの状態管理フック
 * @description
 * /daily/support ページを「利用者選択 → Plan選択 → 行動記録」の
 * 3ステップに分割するためのナビゲーション状態を管理する。
 */

import { useCallback, useMemo, useState } from 'react';

// ─── Types ──────────────────────────────────────────────

export type SupportWizardStep = 'user' | 'plan' | 'record';

export type UseSupportWizardReturn = {
  /** 現在のステップ */
  step: SupportWizardStep;
  /** ステップのインデックス (0, 1, 2) */
  stepIndex: number;
  /** 次のステップへ進む */
  goNext: () => void;
  /** 前のステップへ戻る */
  goBack: () => void;
  /** 指定ステップへ直接ジャンプ */
  goToStep: (step: SupportWizardStep) => void;
  /** Step 1 完了: ユーザーを選択して Plan へ進む */
  selectUserAndProceed: (userId: string) => void;
  /** Step 2 完了: Plan 項目を選択して Record へ進む */
  selectPlanAndProceed: (stepId: string) => void;
  /** Step 3 完了: 保存後に Plan へ戻る（連続入力） */
  returnToPlanAfterSave: () => void;
  /** 選択済みユーザーID */
  wizardUserId: string;
  /** 選択済みスケジュールスロットID */
  wizardSlotId: string;
  /** ステップラベル一覧（Stepper 表示用） */
  stepLabels: readonly string[];
};

// ─── Constants ──────────────────────────────────────────

const STEPS: readonly SupportWizardStep[] = ['user', 'plan', 'record'];
const STEP_LABELS = ['利用者選択', '支援手順 (Plan)', '行動記録 (Do)'] as const;

// ─── Hook ───────────────────────────────────────────────

export function useSupportWizard(
  initialUserId?: string,
  initialStepKey?: string,
): UseSupportWizardReturn {
  // 初期ステップ: userId が指定されていれば plan or record からスタート
  const initialStep: SupportWizardStep = initialUserId
    ? initialStepKey ? 'record' : 'plan'
    : 'user';

  const [step, setStep] = useState<SupportWizardStep>(initialStep);
  const [wizardUserId, setWizardUserId] = useState(initialUserId ?? '');
  const [wizardSlotId, setWizardSlotId] = useState(initialStepKey ?? '');

  const stepIndex = useMemo(() => STEPS.indexOf(step), [step]);

  const goNext = useCallback(() => {
    setStep((prev) => {
      const idx = STEPS.indexOf(prev);
      return idx < STEPS.length - 1 ? STEPS[idx + 1] : prev;
    });
  }, []);

  const goBack = useCallback(() => {
    setStep((prev) => {
      const idx = STEPS.indexOf(prev);
      return idx > 0 ? STEPS[idx - 1] : prev;
    });
  }, []);

  const goToStep = useCallback((target: SupportWizardStep) => {
    setStep(target);
  }, []);

  /** Step 1 → Step 2: ユーザー選択 → Plan へ */
  const selectUserAndProceed = useCallback((userId: string) => {
    setWizardUserId(userId);
    setWizardSlotId(''); // スロットをリセット
    setStep('plan');
  }, []);

  /** Step 2 → Step 3: Plan 項目タップ → Record へ自動遷移 */
  const selectPlanAndProceed = useCallback((stepId: string) => {
    setWizardSlotId(stepId);
    setStep('record');
  }, []);

  /** Step 3 → Step 2: 保存後に Plan へ戻る（連続入力） */
  const returnToPlanAfterSave = useCallback(() => {
    setWizardSlotId(''); // 次のスロット選択のためリセット
    setStep('plan');
  }, []);

  return {
    step,
    stepIndex,
    goNext,
    goBack,
    goToStep,
    selectUserAndProceed,
    selectPlanAndProceed,
    returnToPlanAfterSave,
    wizardUserId,
    wizardSlotId,
    stepLabels: STEP_LABELS,
  };
}
