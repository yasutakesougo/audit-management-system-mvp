/**
 * dailyProcedureMapper.ts — 支援計画シートから原紙形式の支援手順行へのマッピングロジック
 */

import type { SupportPlanningSheet } from '@/domain/isp/schema/ispPlanningSheetSchema';
import { 
  OFFICIAL_PROCEDURE_TEMPLATE, 
  type DailySupportProcedureRow, 
  type DailySupportProcedureDocument
} from '../domain/dailySupportProcedure';
import { type BridgeSource } from '../planningToRecordBridge';

/**
 * 支援計画シートを原紙（支援手順書兼実施記録）ドキュメント形式に変換する。
 * 
 * マッピング方針:
 * 1. 構造化手順 (procedureSteps) がある場合は、行番号(order)、活動名、時間帯の順で17行テンプレートにマッピングする。
 * 2. 構造化手順がない場合は、対応方針・具体策を「AM日中活動」「PM日中活動」に行約して表示する。
 */
export function bridgePlanningSheetToDailyProcedures(
  sheet: SupportPlanningSheet,
  options?: {
    userName?: string;
    staffName?: string;
    recordDate?: string;
  }
): DailySupportProcedureDocument {
  // 1. ソース判定 (Circular Dependency 回避のため外部関数に頼らず判定)
  const hasStructured = (sheet.planning?.procedureSteps?.length ?? 0) > 0;
  const hasFallbackText = !!(sheet.supportPolicy || sheet.concreteApproaches);
  
  const bridgeSource = hasStructured 
    ? 'sheet_structured' 
    : (hasFallbackText ? 'sheet_fallback_text' : 'empty');

  // 2. 17行の器を準備
  const rows: DailySupportProcedureRow[] = bridgeSource === 'empty' ? [] : OFFICIAL_PROCEDURE_TEMPLATE.map(template => ({
    ...template,
    personAction: '',
    supporterAction: '',
    condition: '',
    specialNote: '',
    bridgeSource: bridgeSource as BridgeSource,
  }));

  // 3. マッピング実行
  if (hasStructured) {
    const ispSteps = sheet.planning.procedureSteps;
    
    ispSteps.forEach(step => {
      let matchedRow: DailySupportProcedureRow | undefined;

      // 0. 行番号 (order) でのマッチング (17行モデルの優先判定)
      if (step.order && step.order >= 1 && step.order <= 17) {
        matchedRow = rows.find(r => r.rowNo === step.order);
      }

      const normalizedTiming = step.timing?.replace(/^0/, '');

      // A. 活動内容 (instruction) でのマッチング
      if (!matchedRow) {
        for (const r of rows) {
          if (
            step.instruction && (
              r.activity.includes(step.instruction) || 
              step.instruction.includes(r.activity)
            )
          ) {
            matchedRow = r;
            break;
          }
        }
      }

      // B. 時間帯でのフォールバックマッチング
      if (!matchedRow && normalizedTiming) {
        matchedRow = rows.find(r => r.timeLabel.includes(normalizedTiming));
      }

      if (matchedRow) {
        // マッチした行に反映 (既存の内容がある場合は改行で追加)
        matchedRow.supporterAction = [matchedRow.supporterAction, step.instructionDetail || step.staff || ''].filter(Boolean).join('\n');
        matchedRow.personAction = [matchedRow.personAction, step.activityDetail || step.instruction || ''].filter(Boolean).join('\n');
        matchedRow.condition = [matchedRow.condition, step.condition || ''].filter(Boolean).join('\n');
        
        // 活動名に詳細を付与（任意: UIで見やすくするため）
        if (step.instruction && !matchedRow.activity.includes(step.instruction)) {
          matchedRow.activity = `${matchedRow.activity}（${step.instruction}）`;
        }
      }
    });
  } else if (bridgeSource === 'sheet_fallback_text') {
    // 構造化手順がない場合、または fallback text がある場合
    // AM/PM日中活動に集約する
    const amRow = rows.find(r => r.activity === 'AM日中活動');
    const pmRow = rows.find(r => r.activity === 'PM日中活動');

    if (amRow) {
      amRow.personAction = sheet.supportPolicy ? `【対応方針】\n${sheet.supportPolicy}` : '';
      amRow.supporterAction = sheet.concreteApproaches ? `【具体策】\n${sheet.concreteApproaches}` : '';
    }
    if (pmRow) {
      pmRow.condition = sheet.environmentalAdjustments ? `【環境調整】\n${sheet.environmentalAdjustments}` : '';
    }
  }

  // 4. 特記事項・留意点の集約
  const specialNotes = [
    sheet.environmentalAdjustments ? `【環境調整】${sheet.environmentalAdjustments}` : '',
    sheet.intake?.sensoryTriggers?.length > 0 ? `【感覚トリガー】${sheet.intake.sensoryTriggers.join('、')}` : '',
    sheet.intake?.medicalFlags?.length > 0 ? `【医療上の留意点】${sheet.intake.medicalFlags.join('、')}` : '',
  ].filter(Boolean).join('\n');

  // 5. ドキュメント全体の組み立て
  return {
    title: '支援手順書兼実施記録',
    userName: options?.userName || `利用者ID: ${sheet.userId}`,
    recordDate: options?.recordDate || new Date().toLocaleDateString('ja-JP'),
    staffName: options?.staffName || sheet.authoredByStaffId || '',
    rows,
    dailyCarePoints: sheet.supportPolicy.slice(0, 100) + (sheet.supportPolicy.length > 100 ? '...' : ''),
    otherNotes: '',
    specialNotes: specialNotes,
  };
}
