/**
 * planningToRecordBridge.ts — 支援計画シート → 支援手順書兼記録 データブリッジ
 *
 * 支援計画シートの方針・具体策・注意事項を、
 * 手順書兼記録（ProcedureStep）のフィールドに安全に変換する純関数群。
 *
 * 設計方針:
 *  - assessmentBridge.ts と同じパターン: 純関数 + マージ + 冪等性 + provenance
 *  - 上書きではなく「追記マージ」: 既存の手順ステップを保持しつつ新規を追加
 *  - 出典の明示: planning_sheet provenance エントリを自動生成
 *
 * マッピング:
 *   supportPolicy        → procedureStep.instruction（支援観点として取込）
 *   concreteApproaches   → procedureStep.instruction（具体的手順として取込）
 *   environmentalAdjustments → 新規ステップの instruction に追記（留意点）
 *   intake.sensoryTriggers → 全ステップ共通の注記欄（instruction 末尾に補足）
 *   intake.medicalFlags  → 全ステップ共通の注記欄（instruction 末尾に補足）
 *
 * @see assessmentBridge.ts — 同一パターンの先行実装
 */
import type { PlanningIntake, PlanningSheetFormValues, SupportPlanningSheet } from '@/domain/isp/schema';
import { toDailyProcedureSteps } from '@/domain/isp/bridge/toDailyProcedureSteps';
import type { ProcedureStep } from '@/features/daily/domain/legacy/ProcedureRepository';
import type { ProvenanceEntry } from '@/features/planning-sheet/assessmentBridge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlanningToRecordBridgeResult {
  /** 生成された手順ステップ群 */
  steps: ProcedureStep[];
  /** 補助情報テキスト（全ステップに共通する注記） */
  globalNotes: string;
  /** 変換サマリー */
  summary: {
    policyStepsGenerated: number;
    approachStepsGenerated: number;
    environmentStepGenerated: boolean;
    sensoryNotesAdded: boolean;
    medicalNotesAdded: boolean;
    totalSteps: number;
  };
  /** 変換根拠 */
  provenance: ProvenanceEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * テキストを改行またはセンテンスで分割し、空行を除去する。
 * 「・」や数字付きリスト行もそれぞれ独立した要素として扱う。
 */
function splitToItems(text: string): string[] {
  if (!text.trim()) return [];
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/**
 * 既存のステップと重複しない instruction かチェック。
 * instruction の先頭30文字の一致で重複判定。
 */
function isDuplicate(existing: ProcedureStep[], instruction: string): boolean {
  const prefix = instruction.slice(0, 30);
  return existing.some((s) => s.instruction.slice(0, 30) === prefix);
}

// ---------------------------------------------------------------------------
// Main Bridge Function
// ---------------------------------------------------------------------------

/**
 * 支援計画シートのデータを手順ステップに変換する。
 *
 * @param sheet - 支援計画シート（ドメインモデルまたはフォーム値 + intake）
 * @param existingSteps - 現在の手順ステップ群（マージ対象）
 * @param planningSheetId - 支援計画シート ID（provenance 追跡用）
 */
export function bridgePlanningToRecord(
  sheet: {
    form: Pick<PlanningSheetFormValues,
      'supportPolicy' | 'concreteApproaches' | 'environmentalAdjustments' | 'title'
    >;
    intake: Pick<PlanningIntake, 'sensoryTriggers' | 'medicalFlags'>;
  },
  existingSteps: ProcedureStep[],
  planningSheetId: string,
): PlanningToRecordBridgeResult {
  const now = new Date().toISOString();
  const provenance: ProvenanceEntry[] = [];
  const newSteps: ProcedureStep[] = [];
  let nextOrder = existingSteps.length + 1;

  // ── 1. 支援方針 → 手順ステップ ──
  const policyItems = splitToItems(sheet.form.supportPolicy);
  let policyStepsGenerated = 0;

  for (const item of policyItems) {
    if (isDuplicate(existingSteps, item)) continue;
    newSteps.push({
      time: '',
      activity: '支援方針',
      instruction: item,
      isKey: true,
      planningSheetId,
      sourceStepOrder: nextOrder,
      source: 'planning_sheet',
    });
    nextOrder++;
    policyStepsGenerated++;
  }

  if (policyStepsGenerated > 0) {
    provenance.push({
      field: 'procedureSteps',
      source: 'planning_sheet',
      sourceLabel: `支援計画シート「${sheet.form.title}」— 対応方針`,
      reason: `対応方針から ${policyStepsGenerated}件の手順ステップを生成`,
      value: policyItems.slice(0, 3).join(' / ') + (policyItems.length > 3 ? ` 他${policyItems.length - 3}件` : ''),
      importedAt: now,
    });
  }

  // ── 2. 具体的対応策 → 手順ステップ ──
  const approachItems = splitToItems(sheet.form.concreteApproaches);
  let approachStepsGenerated = 0;

  for (const item of approachItems) {
    if (isDuplicate(existingSteps, item)) continue;
    newSteps.push({
      time: '',
      activity: '具体的対応',
      instruction: item,
      isKey: false,
      planningSheetId,
      sourceStepOrder: nextOrder,
      source: 'planning_sheet',
    });
    nextOrder++;
    approachStepsGenerated++;
  }

  if (approachStepsGenerated > 0) {
    provenance.push({
      field: 'procedureSteps',
      source: 'planning_sheet',
      sourceLabel: `支援計画シート「${sheet.form.title}」— 具体策`,
      reason: `関わり方の具体策から ${approachStepsGenerated}件の手順ステップを生成`,
      value: approachItems.slice(0, 3).join(' / ') + (approachItems.length > 3 ? ` 他${approachItems.length - 3}件` : ''),
      importedAt: now,
    });
  }

  // ── 3. 環境調整 → 留意点ステップ ──
  let environmentStepGenerated = false;
  const envText = sheet.form.environmentalAdjustments.trim();
  if (envText && !isDuplicate(existingSteps, `【環境調整】${envText}`)) {
    newSteps.push({
      time: '',
      activity: '環境調整（留意点）',
      instruction: `【環境調整】${envText}`,
      isKey: false,
      planningSheetId,
      sourceStepOrder: nextOrder,
      source: 'planning_sheet',
    });
    nextOrder++;
    environmentStepGenerated = true;
    provenance.push({
      field: 'procedureSteps',
      source: 'planning_sheet',
      sourceLabel: `支援計画シート「${sheet.form.title}」— 環境調整`,
      reason: '環境調整の内容を留意点ステップとして追加',
      value: envText.slice(0, 100) + (envText.length > 100 ? '…' : ''),
      importedAt: now,
    });
  }

  // ── 4. 補助情報: 感覚トリガー + 医療フラグ → globalNotes ──
  const notesParts: string[] = [];
  let sensoryNotesAdded = false;
  let medicalNotesAdded = false;

  if (sheet.intake.sensoryTriggers.length > 0) {
    notesParts.push(`【感覚トリガー】${sheet.intake.sensoryTriggers.join('、')}`);
    sensoryNotesAdded = true;
    provenance.push({
      field: 'globalNotes',
      source: 'planning_sheet',
      sourceLabel: `支援計画シート「${sheet.form.title}」— 感覚トリガー`,
      reason: `${sheet.intake.sensoryTriggers.length}件の感覚トリガーを全ステップ共通注記に追加`,
      value: sheet.intake.sensoryTriggers.join('、'),
      importedAt: now,
    });
  }

  if (sheet.intake.medicalFlags.length > 0) {
    notesParts.push(`【医療上の留意点】${sheet.intake.medicalFlags.join('、')}`);
    medicalNotesAdded = true;
    provenance.push({
      field: 'globalNotes',
      source: 'planning_sheet',
      sourceLabel: `支援計画シート「${sheet.form.title}」— 医療フラグ`,
      reason: `${sheet.intake.medicalFlags.length}件の医療フラグを全ステップ共通注記に追加`,
      value: sheet.intake.medicalFlags.join('、'),
      importedAt: now,
    });
  }

  return {
    steps: newSteps,
    globalNotes: notesParts.join('\n'),
    summary: {
      policyStepsGenerated,
      approachStepsGenerated,
      environmentStepGenerated,
      sensoryNotesAdded,
      medicalNotesAdded,
      totalSteps: newSteps.length,
    },
    provenance,
  };
}

/**
 * SupportPlanningSheet ドメインモデルから直接ブリッジを呼ぶ convenience 関数。
 */
export function bridgeSheetToRecord(
  sheet: SupportPlanningSheet,
  existingSteps: ProcedureStep[],
): PlanningToRecordBridgeResult {
  return bridgePlanningToRecord(
    {
      form: {
        supportPolicy: sheet.supportPolicy,
        concreteApproaches: sheet.concreteApproaches,
        environmentalAdjustments: sheet.environmentalAdjustments,
        title: sheet.title,
      },
      intake: {
        sensoryTriggers: sheet.intake.sensoryTriggers,
        medicalFlags: sheet.intake.medicalFlags,
      },
    },
    existingSteps,
    sheet.id,
  );
}

export type BridgeSource = 'sheet_structured' | 'sheet_fallback_text' | 'empty' | 'repository_default';

export interface BridgeProceduresResult {
  steps: ProcedureStep[];
  source: BridgeSource;
}

/**
 * 支援計画シートを手順記録（Daily スケジュール）へ変換する。
 *
 * 戦略:
 * 1. 構造化された手順リスト (L2 Planning) があればそれを優先する。
 * 2. 構造化データがない場合は、テキスト項目（対応方針・具体策）から抽出生成する。
 *
 * @param sheet 支援計画シート
 * @returns 変換後の手順ステップ配列とソース情報
 */
export function bridgePlanningSheetToDailyProcedures(
  sheet: SupportPlanningSheet,
): BridgeProceduresResult {
  // 1. 構造化手順リストの変換を試行
  const structuredSteps = toDailyProcedureSteps(sheet.planning, sheet.id);
  if (structuredSteps.length > 0) {
    return {
      steps: structuredSteps,
      source: 'sheet_structured',
    };
  }

  // 2. 構造化データがない場合はテキスト項目からのブリッジを試行
  const bridgedResult = bridgeSheetToRecord(sheet, []);
  if (bridgedResult.steps.length > 0) {
    return {
      steps: bridgedResult.steps,
      source: 'sheet_fallback_text',
    };
  }

  return {
    steps: [],
    source: 'empty',
  };
}
