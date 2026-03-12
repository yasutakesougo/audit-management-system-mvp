/**
 * resolveProcedureSteps — 手順の優先解決ロジック
 *
 * 支援計画シート由来の手順を優先し、なければ既存の ProcedureStore / BASE_STEPS へフォールバック。
 *
 * 優先順位:
 *   1. planning_sheet — 支援計画シートの planningDesign.procedureSteps を変換した手順
 *   2. csv_import    — CSV インポートで登録された手順
 *   3. base_steps    — ハードコードの BASE_STEPS フォールバック
 *
 * この関数は純粋関数であり、副作用を持たない。
 */
import type { PlanningDesign } from '@/domain/isp/schema';
import { toDailyProcedureSteps } from '@/domain/isp/bridge/toDailyProcedureSteps';
import type { ProcedureStep, ProcedureSource } from '@/features/daily/domain/ProcedureRepository';

export type ProcedureResolutionResult = {
  /** 解決された手順 */
  steps: ProcedureStep[];
  /** 解決元 */
  resolvedFrom: ProcedureSource;
  /** 支援計画シートID（planning_sheet の場合） */
  planningSheetId?: string;
};

export type ProcedureResolutionInput = {
  /** 支援計画シートの planningDesign（取得済みの場合） */
  planningDesign?: PlanningDesign | null;
  /** 支援計画シートID */
  planningSheetId?: string | null;
  /** activityLabels（ISP 側の活動名を補完する場合） */
  activityLabels?: Record<number, string>;
  /** 既存の ProcedureStore から取得した手順 */
  storeSteps?: ProcedureStep[];
  /** 既存 store にユーザーデータがあるか */
  hasStoreData?: boolean;
};

/**
 * 手順の優先解決を行う。
 *
 * - planningDesign に procedureSteps がある → planning_sheet 由来として変換
 * - ProcedureStore にデータがある → csv_import 由来（またはそのまま）
 * - どちらもない → BASE_STEPS（呼び出し元の store が返す）として通す
 */
export function resolveProcedureSteps(
  input: ProcedureResolutionInput,
): ProcedureResolutionResult {
  // 1. 支援計画シート由来の手順が最優先
  if (
    input.planningDesign &&
    input.planningSheetId &&
    input.planningDesign.procedureSteps.length > 0
  ) {
    const steps = toDailyProcedureSteps(
      input.planningDesign,
      input.planningSheetId,
      { activityLabels: input.activityLabels },
    );
    return {
      steps,
      resolvedFrom: 'planning_sheet',
      planningSheetId: input.planningSheetId,
    };
  }

  // 2. ProcedureStore にユーザー固有データがある（CSV インポートなど）
  if (input.hasStoreData && input.storeSteps && input.storeSteps.length > 0) {
    return {
      steps: input.storeSteps.map((s) => ({
        ...s,
        source: s.source ?? 'csv_import',
      })),
      resolvedFrom: 'csv_import',
    };
  }

  // 3. フォールバック: BASE_STEPS（store が返すデフォルト）
  const fallbackSteps = (input.storeSteps ?? []).map((s) => ({
    ...s,
    source: s.source ?? 'base_steps' as const,
  }));
  return {
    steps: fallbackSteps,
    resolvedFrom: 'base_steps',
  };
}
