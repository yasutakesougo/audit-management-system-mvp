/**
 * supportTemplateBridge — SupportTemplate CSV / ScheduleItem ⇔ ProcedureStep 変換
 *
 * 既存の支援手順データ（SupportTemplate CSV / Daily の ScheduleItem）を
 * PlanningSheet の ProcedureStep に取り込むためのブリッジ。
 *
 * ADR-006 準拠: Daily → PlanningSheet の参照方向に沿った変換のみ。
 * Daily が PlanningSheet を書き換えることはない。
 * あくまで「既存テンプレートを新アーキテクチャに取り込む」目的。
 *
 * @see src/domain/isp/schema.ts — ProcedureStep
 * @see src/features/import/domain/parseSupportTemplateCsv.ts — CSV パーサー
 * @see src/features/daily/components/split-stream/ProcedurePanel.tsx — ScheduleItem
 */
import type { ProcedureStep } from '@/domain/isp/schema';
import type { SupportTemplateCsvRow } from '@/features/import/domain/csvImportTypes';
import { normalizeTimeSlot } from '@/features/import/domain/parseSupportTemplateCsv';
import type { ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';

// ─────────────────────────────────────────────
// CSV → ProcedureStep
// ─────────────────────────────────────────────

/**
 * SupportTemplate CSV 行を ProcedureStep に変換する。
 *
 * マッピング:
 *  - RowNo → order
 *  - 活動内容 + 本人の動き → instruction（活動内容がベース、本人の動きは補足）
 *  - 支援者の動き → staff
 *  - 時間帯 → timing
 */
export function csvRowToProcedureStep(row: SupportTemplateCsvRow, index: number): ProcedureStep | null {
  const activity = row['活動内容']?.trim();
  if (!activity) return null;

  const personManual = row['本人の動き']?.trim() ?? '';
  const supporterManual = row['支援者の動き']?.trim() ?? '';
  const timeSlot = row['時間帯']?.trim() ?? '';
  const rowNo = parseInt(row.RowNo, 10);

  // 活動内容と本人の動きを結合
  const instruction = personManual
    ? `${activity}（${personManual}）`
    : activity;

  return {
    order: Number.isFinite(rowNo) ? rowNo : index + 1,
    instruction,
    staff: supporterManual,
    timing: timeSlot ? normalizeTimeSlot(timeSlot) : '',
  };
}

/**
 * 複数の CSV 行を ProcedureStep[] に一括変換。
 * 無効な行はスキップし、order 順でソート。
 */
export function csvRowsToProcedureSteps(rows: SupportTemplateCsvRow[]): ProcedureStep[] {
  const steps: ProcedureStep[] = [];

  for (let i = 0; i < rows.length; i++) {
    const step = csvRowToProcedureStep(rows[i], i);
    if (step) steps.push(step);
  }

  // order 順にソート + re-number
  steps.sort((a, b) => a.order - b.order);
  return steps.map((s, i) => ({ ...s, order: i + 1 }));
}

// ─────────────────────────────────────────────
// ScheduleItem ⇔ ProcedureStep
// ─────────────────────────────────────────────

/**
 * Daily の ScheduleItem を ProcedureStep に変換。
 *
 * マッピング:
 *  - time → timing
 *  - activity → instruction
 *  - instruction → staff（支援者の動き）
 */
export function scheduleItemToProcedureStep(item: ScheduleItem, order: number): ProcedureStep {
  return {
    order,
    instruction: item.activity,
    staff: item.instruction,
    timing: item.time,
  };
}

/**
 * ScheduleItem[] → ProcedureStep[] 一括変換。
 */
export function scheduleItemsToProcedureSteps(items: ScheduleItem[]): ProcedureStep[] {
  return items.map((item, i) => scheduleItemToProcedureStep(item, i + 1));
}

/**
 * ProcedureStep を Daily の ScheduleItem に変換（逆方向）。
 *
 * PlanningSheet の手順を Daily で表示するために使用。
 */
export function procedureStepToScheduleItem(step: ProcedureStep): ScheduleItem {
  return {
    id: `ps-${step.order}`,
    time: step.timing,
    activity: step.instruction,
    instruction: step.staff,
    isKey: false,
    linkedInterventionIds: [],
  };
}

/**
 * ProcedureStep[] → ScheduleItem[] 一括変換。
 */
export function procedureStepsToScheduleItems(steps: ProcedureStep[]): ScheduleItem[] {
  return steps
    .sort((a, b) => a.order - b.order)
    .map(procedureStepToScheduleItem);
}
