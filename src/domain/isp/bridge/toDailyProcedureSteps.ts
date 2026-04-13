/**
 * toDailyProcedureSteps — 支援計画シートの手順設計を Daily の時間割へ変換する Adapter
 *
 * ISP 三層モデルの PlanningDesign.procedureSteps (抽象手順) を
 * Daily ドメインの ProcedureStep[] (時間割ベース) に変換する。
 *
 * 構造差:
 *   ISP側:   order / instruction / staff / timing
 *   Daily側: time / activity / instruction / isKey
 *
 * この Adapter があることで、支援計画シートを作成・更新するだけで
 * /daily/support の時間割が自動更新される。
 */
import type { PlanningDesign, ProcedureStep as IspProcedureStep } from '@/domain/isp/schema';
import type { ProcedureStep } from '@/features/daily/domain/legacy/ProcedureRepository';

/**
 * ISP の timing フィールドから HH:MM 形式の時刻を抽出する。
 * 合致しない場合は null を返す。
 */
export function parseTimingToTime(timing: string): string | null {
  const match = timing.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * order ベースのデフォルト時刻を生成する。
 * 09:00 から 30 分刻みで割り当てる。
 */
export function generateDefaultTime(order: number): string {
  const baseHour = 9;
  const totalMinutes = (order - 1) * 30;
  const h = baseHour + Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(Math.min(h, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * instruction から活動名を抽出する。
 *
 * ルール:
 * 1. 最初の句点（。）までを取る（なければ全文）
 * 2. 40文字で切る
 *
 * 将来: ISP 側に activityLabel が追加されたらそちらを優先
 */
export function extractActivityLabel(
  instruction: string,
  activityLabel?: string,
): string {
  if (activityLabel) return activityLabel;
  const firstSentence = instruction.split(/[。.]/)[0].trim();
  if (!firstSentence) return instruction.slice(0, 40);
  return firstSentence.length > 40
    ? firstSentence.slice(0, 37) + '…'
    : firstSentence;
}

/**
 * 支援計画シートの planningDesign.procedureSteps を
 * Daily の ProcedureStep[] へ変換する。
 *
 * @param design - 支援計画シートの planningDesign セクション
 * @param planningSheetId - 導出元の支援計画シートID
 * @param options - オプション（activityLabels で ISP 側の活動名を補完可能）
 */
export function toDailyProcedureSteps(
  design: PlanningDesign,
  planningSheetId: string,
  options?: {
    /** ISP 側の activityLabel 配列（order に対応） */
    activityLabels?: Record<number, string>;
  },
): ProcedureStep[] {
  const steps = design.procedureSteps;
  if (!steps || steps.length === 0) return [];

  // order 順でソート（元の配列を壊さない）
  const sorted = [...steps].sort((a, b) => a.order - b.order);

  return sorted.map((ispStep: IspProcedureStep, index: number) => {
    const parsedTime = parseTimingToTime(ispStep.timing);
    const time = parsedTime ?? generateDefaultTime(ispStep.order);
    const activityLabel = options?.activityLabels?.[ispStep.order];

    return {
      id: `ps-${planningSheetId}-${ispStep.order}-${index}`,
      time,
      activity: extractActivityLabel(ispStep.instruction, activityLabel),
      instruction: ispStep.instruction,
      isKey: index === 0 || index === sorted.length - 1,
      planningSheetId,
      sourceStepOrder: ispStep.order,
      source: 'planning_sheet' as const,
    };
  });
}
