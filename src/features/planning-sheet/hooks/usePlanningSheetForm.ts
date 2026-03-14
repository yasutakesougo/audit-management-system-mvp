/**
 * usePlanningSheetForm — 支援計画シートのフォーム管理 hook
 *
 * ADR-006 準拠:
 *  - PlanningSheet の読み書きを担当
 *  - ISP 本文の書き込みは禁止
 *
 * 責務:
 *  - SupportPlanningSheet → PlanningSheetFormValues への変換
 *  - dirty tracking / validation
 *  - save / update 操作
 *
 * @see src/domain/isp/port.ts — PlanningSheetRepository Port
 * @see src/domain/isp/schema.ts — PlanningSheetFormValues, planningSheetFormSchema
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { SupportPlanningSheet, PlanningAssessment, PlanningIntake, PlanningDesign } from '@/domain/isp/schema';
import { planningSheetFormSchema, type PlanningSheetFormValues } from '@/domain/isp/schema';
import type { PlanningSheetRepository, PlanningSheetUpdateInput } from '@/domain/isp/port';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface UsePlanningSheetFormReturn {
  /** フォームの現在値 */
  values: PlanningSheetFormValues;
  /** フォーム値を更新する */
  setFieldValue: <K extends keyof PlanningSheetFormValues>(
    field: K,
    value: PlanningSheetFormValues[K],
  ) => void;
  /** フォーム値を一括更新する */
  setValues: (partial: Partial<PlanningSheetFormValues>) => void;
  /** 構造化セクション（assessment / intake / planning） */
  assessment: PlanningAssessment;
  setAssessment: (updated: PlanningAssessment) => void;
  intake: PlanningIntake;
  setIntake: (updated: PlanningIntake) => void;
  planning: PlanningDesign;
  setPlanning: (updated: PlanningDesign) => void;
  /** 変更がある */
  isDirty: boolean;
  /** 保存中 */
  isSaving: boolean;
  /** 保存エラー */
  saveError: string | null;
  /** バリデーションエラー（フィールドごと） */
  validationErrors: Partial<Record<keyof PlanningSheetFormValues, string>>;
  /** フォームが valid か */
  isValid: boolean;
  /** 保存（Repository.update() 呼び出し） */
  save: () => Promise<SupportPlanningSheet | null>;
  /** 変更を破棄（初期値に戻す） */
  reset: () => void;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/**
 * SupportPlanningSheet → PlanningSheetFormValues 変換。
 * ドメインモデルからフォーム用のサブセットを抽出する。
 */
function sheetToFormValues(sheet: SupportPlanningSheet): PlanningSheetFormValues {
  return {
    userId: sheet.userId,
    ispId: sheet.ispId,
    title: sheet.title,
    targetScene: sheet.targetScene ?? '',
    targetDomain: sheet.targetDomain ?? '',
    observationFacts: sheet.observationFacts,
    collectedInformation: sheet.collectedInformation ?? '',
    interpretationHypothesis: sheet.interpretationHypothesis,
    supportIssues: sheet.supportIssues,
    supportPolicy: sheet.supportPolicy,
    environmentalAdjustments: sheet.environmentalAdjustments ?? '',
    concreteApproaches: sheet.concreteApproaches,
    appliedFrom: sheet.appliedFrom ?? undefined,
    nextReviewAt: sheet.nextReviewAt ?? undefined,
    authoredByStaffId: sheet.authoredByStaffId ?? '',
    authoredByQualification: sheet.authoredByQualification,
    authoredAt: sheet.authoredAt ?? undefined,
    applicableServiceType: sheet.applicableServiceType,
    applicableAddOnTypes: sheet.applicableAddOnTypes,
    deliveredToUserAt: sheet.deliveredToUserAt ?? undefined,
    reviewedAt: sheet.reviewedAt ?? undefined,
    hasMedicalCoordination: sheet.hasMedicalCoordination,
    hasEducationCoordination: sheet.hasEducationCoordination,
    supportStartDate: sheet.supportStartDate ?? undefined,
    monitoringCycleDays: sheet.monitoringCycleDays ?? 90,
    status: sheet.status,
  };
}

/**
 * 2つの PlanningSheetFormValues を浅い比較して dirty を判定。
 */
function isFormDirty(
  current: PlanningSheetFormValues,
  initial: PlanningSheetFormValues,
): boolean {
  const keys = Object.keys(current) as (keyof PlanningSheetFormValues)[];
  for (const key of keys) {
    const a = current[key];
    const b = initial[key];
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length || a.some((v, i) => v !== b[i])) return true;
    } else if (a !== b) {
      return true;
    }
  }
  return false;
}

/**
 * Zod バリデーション結果をフィールドごとのエラーメッセージに変換。
 */
function validateForm(
  values: PlanningSheetFormValues,
): Partial<Record<keyof PlanningSheetFormValues, string>> {
  const result = planningSheetFormSchema.safeParse(values);
  if (result.success) return {};

  const errors: Partial<Record<keyof PlanningSheetFormValues, string>> = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as keyof PlanningSheetFormValues | undefined;
    if (field && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return errors;
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

/**
 * 支援計画シートのフォーム管理 hook。
 *
 * @param sheet - 既存の SupportPlanningSheet（読み込み済み）。null なら空フォーム。
 * @param repo - PlanningSheetRepository インスタンス。null なら save 不可。
 * @param onSaved - 保存完了後のコールバック（refetch など）。
 */
export function usePlanningSheetForm(
  sheet: SupportPlanningSheet | null,
  repo: PlanningSheetRepository | null,
  onSaved?: (updated: SupportPlanningSheet) => void,
): UsePlanningSheetFormReturn {
  const initialValues = useMemo<PlanningSheetFormValues>(() => {
    if (!sheet) {
      // sheet が null（未ロード・エラー）の場合はデフォルト値を返す。
      // Zod の parse() は使わない（必須フィールドが空で ZodError になるため）。
      return {
        userId: '',
        ispId: '',
        title: '',
        targetScene: '',
        targetDomain: '',
        observationFacts: '',
        collectedInformation: '',
        interpretationHypothesis: '',
        supportIssues: '',
        supportPolicy: '',
        environmentalAdjustments: '',
        concreteApproaches: '',
        appliedFrom: undefined,
        nextReviewAt: undefined,
        authoredByStaffId: '',
        authoredByQualification: 'unknown',
        authoredAt: undefined,
        applicableServiceType: 'other',
        applicableAddOnTypes: ['none'],
        deliveredToUserAt: undefined,
        reviewedAt: undefined,
        hasMedicalCoordination: false,
        hasEducationCoordination: false,
        supportStartDate: undefined,
        monitoringCycleDays: 90,
        status: 'draft',
      } satisfies PlanningSheetFormValues;
    }
    return sheetToFormValues(sheet);
  }, [sheet]);

  const [values, setValuesState] = useState<PlanningSheetFormValues>(initialValues);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 構造化セクションの state
  const defaultAssessment: PlanningAssessment = { targetBehaviors: [], abcEvents: [], hypotheses: [], riskLevel: 'low', healthFactors: [], teamConsensusNote: '' };
  const defaultIntake: PlanningIntake = { presentingProblem: '', targetBehaviorsDraft: [], behaviorItemsTotal: null, incidentSummaryLast30d: '', communicationModes: [], sensoryTriggers: [], medicalFlags: [], consentScope: [], consentDate: null };
  const defaultPlanning: PlanningDesign = { supportPriorities: [], antecedentStrategies: [], teachingStrategies: [], consequenceStrategies: [], procedureSteps: [], crisisThresholds: null, restraintPolicy: 'prohibited_except_emergency', reviewCycleDays: 180 };

  const [assessmentState, setAssessmentState] = useState<PlanningAssessment>(sheet?.assessment ?? defaultAssessment);
  const [intakeState, setIntakeState] = useState<PlanningIntake>(sheet?.intake ?? defaultIntake);
  const [planningState, setPlanningState] = useState<PlanningDesign>(sheet?.planning ?? defaultPlanning);

  // initialValues が変わったら values もリセット（useEffect で安全に）
  const prevInitialRef = useRef(initialValues);
  useEffect(() => {
    if (prevInitialRef.current !== initialValues) {
      prevInitialRef.current = initialValues;
      setValuesState(initialValues);
      // 構造化セクションもリセット
      setAssessmentState(sheet?.assessment ?? defaultAssessment);
      setIntakeState(sheet?.intake ?? defaultIntake);
      setPlanningState(sheet?.planning ?? defaultPlanning);
    }
  }, [initialValues, sheet]);

  // ── Computed State ──
  const isDirty = useMemo(() => isFormDirty(values, initialValues), [values, initialValues]);
  const validationErrors = useMemo(() => validateForm(values), [values]);
  const isValid = useMemo(() => Object.keys(validationErrors).length === 0, [validationErrors]);

  // ── Field-level setter ──
  const setFieldValue = useCallback(<K extends keyof PlanningSheetFormValues>(
    field: K,
    value: PlanningSheetFormValues[K],
  ) => {
    setValuesState((prev) => ({ ...prev, [field]: value }));
  }, []);

  // ── Bulk setter ──
  const setValues = useCallback((partial: Partial<PlanningSheetFormValues>) => {
    setValuesState((prev) => ({ ...prev, ...partial }));
  }, []);

  const reset = useCallback(() => {
    setValuesState(initialValues);
    setAssessmentState(sheet?.assessment ?? defaultAssessment);
    setIntakeState(sheet?.intake ?? defaultIntake);
    setPlanningState(sheet?.planning ?? defaultPlanning);
    setSaveError(null);
  }, [initialValues, sheet]);

  // ── Save ──
  const save = useCallback(async (): Promise<SupportPlanningSheet | null> => {
    if (!sheet || !repo) {
      setSaveError('保存先が未設定です');
      return null;
    }


    if (!isValid) {
      setSaveError('入力にエラーがあります');
      return null;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const updateInput: PlanningSheetUpdateInput = {
        ...values,
        // 構造化セクションは編集後の現在値を送信
        intake: intakeState,
        assessment: assessmentState,
        planning: planningState,
        regulatoryBasisSnapshot: sheet.regulatoryBasisSnapshot ?? undefined,
      };

      const updated = await repo.update(sheet.id, updateInput);
      onSaved?.(updated);
      return updated;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(msg);
      console.warn('[usePlanningSheetForm] Save failed:', msg);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [sheet, repo, values, isValid, onSaved, intakeState, assessmentState, planningState]);

  return {
    values,
    setFieldValue,
    setValues,
    assessment: assessmentState,
    setAssessment: setAssessmentState,
    intake: intakeState,
    setIntake: setIntakeState,
    planning: planningState,
    setPlanning: setPlanningState,
    isDirty,
    isSaving,
    saveError,
    validationErrors,
    isValid,
    save,
    reset,
  };
}
