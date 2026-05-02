/**
 * dailyProcedureMapper.ts — 支援計画シートから原紙形式の支援手順行へのマッピングロジック
 */

import type { SupportPlanningSheet } from '@/domain/isp/schema/ispPlanningSheetSchema';
import { 
  OFFICIAL_PROCEDURE_TEMPLATE, 
  type DailySupportProcedureRow, 
  type DailySupportProcedureDocument
} from '../domain/dailySupportProcedure';
import { 
  bridgeSheetToRecord, 
  type BridgeSource 
} from '../planningToRecordBridge';

/**
 * 支援計画シートを原紙（支援手順書兼実施記録）ドキュメント形式に変換する。
 */
export function bridgePlanningSheetToDailyProcedures(
  sheet: SupportPlanningSheet,
  options?: {
    userName?: string;
    staffName?: string;
    recordDate?: string;
  }
): DailySupportProcedureDocument {
  // 1. 構造化手順の取得
  const bridged = bridgeSheetToRecord(sheet, []);
  
  // ソース判定
  const hasStructured = sheet.planning.procedureSteps.length > 0;
  const bridgeSource: BridgeSource = hasStructured 
    ? 'sheet_structured' 
    : (bridged.steps.length > 0 ? 'sheet_fallback_text' : 'empty');

  // 2. 17行の器を準備
  const rows: DailySupportProcedureRow[] = OFFICIAL_PROCEDURE_TEMPLATE.map(template => ({
    ...template,
    personAction: '',
    supporterAction: '',
    condition: '',
    specialNote: '',
    bridgeSource,
  }));

  // 3. マッピング実行
  if (hasStructured) {
    const ispSteps = sheet.planning.procedureSteps;
    
    ispSteps.forEach(step => {
      // 時間の正規化 (09:30 -> 9:30)
      const normalizedTiming = step.timing?.replace(/^0/, '');
      
      const targetRow = rows.find(r => {
        // 活動名でのマッチング（原紙側の活動名が手順に含まれているか、またはその逆）
        const activityMatch = r.activity && step.instruction && (
          step.instruction.includes(r.activity.slice(0, 4)) || 
          r.activity.includes(step.instruction.slice(0, 4))
        );
        
        // 時間でのマッチング
        const timeMatch = normalizedTiming && r.timeLabel.includes(normalizedTiming);
        
        return activityMatch || timeMatch;
      });

      if (targetRow) {
        targetRow.personAction = step.instruction;
        targetRow.supporterAction = step.staff || '';
      } else {
        const fallbackActivity = step.timing?.startsWith('1') && !step.timing.startsWith('10') && !step.timing.startsWith('11')
          ? 'PM日中活動' 
          : 'AM日中活動';
        
        const mainRow = rows.find(r => r.activity === fallbackActivity);
        if (mainRow) {
          mainRow.personAction += (mainRow.personAction ? '\n' : '') + step.instruction;
          mainRow.supporterAction += (mainRow.supporterAction ? '\n' : '') + (step.staff || '');
        }
      }
    });
  } else if (bridgeSource === 'sheet_fallback_text') {
    const amRow = rows.find(r => r.activity === 'AM日中活動');
    const pmRow = rows.find(r => r.activity === 'PM日中活動');

    if (amRow) {
      amRow.personAction = '【対応方針】\n' + sheet.supportPolicy;
      amRow.supporterAction = '【具体策】\n' + sheet.concreteApproaches;
    }
    if (pmRow) {
      pmRow.personAction = '（AMと同様）';
      pmRow.supporterAction = '（AMと同様）';
    }
  }

  // 4. 特記事項・留意点の集約
  const specialNotes = [
    sheet.environmentalAdjustments ? `【環境調整】${sheet.environmentalAdjustments}` : '',
    sheet.intake.sensoryTriggers.length > 0 ? `【感覚トリガー】${sheet.intake.sensoryTriggers.join('、')}` : '',
    sheet.intake.medicalFlags.length > 0 ? `【医療上の留意点】${sheet.intake.medicalFlags.join('、')}` : '',
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
