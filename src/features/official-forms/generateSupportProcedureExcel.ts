/**
 * 支援手順書兼実施記録 — Excel生成
 *
 * 原紙（Excel）のセルマッピング設計に基づき、支援計画シートから変換された
 * DailySupportProcedureDocument を ExcelJS で差し込み出力する。
 *
 * ■ セルマッピング:
 *   ヘッダ:
 *     A1:AF1   タイトル (固定)
 *     A2 付近   利用者氏名 (userName)
 *     A3:Q4    サービス提供日 (recordDate)
 *     Y3:AF4   作成者 (staffName)
 *   
 *   明細行 (Row 7-15, 18-23, 25-26):
 *     A:D      時間 (timeLabel)
 *     E:J      活動内容 (activity)
 *     K:Q      本人の動き (personAction)
 *     R:Z      支援者の動き (supporterAction)
 *     AA:AF    本人の様子 (condition)
 *
 *   フッタ:
 *     A28:AF28  一日を通して気を付ける事 (dailyCarePoints)
 *     A30:AF30  その他 (otherNotes)
 *     A32:AF35  特記事項 (specialNotes)
 */

import ExcelJS from 'exceljs';
import type { DailySupportProcedureDocument } from '../planning-sheet/domain/dailySupportProcedure';

export interface SupportProcedureExcelOutput {
  fileName: string;
  bytes: ArrayBuffer;
}

/**
 * 支援手順書兼実施記録の Excel を生成する。
 *
 * @param templateBuffer - テンプレート Excel のバイナリ
 * @param data - 差し込みデータ
 */
export async function generateSupportProcedureExcel(
  templateBuffer: ArrayBuffer,
  data: DailySupportProcedureDocument,
): Promise<SupportProcedureExcelOutput> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);

  const ws = wb.worksheets[0]; // 最初のシートを使用
  if (!ws) throw new Error('テンプレートにワークシートがありません');

  // 1. ヘッダ差し込み
  ws.getCell('A2').value = `利用者氏名： ${data.userName}`;
  ws.getCell('A3').value = `サービス提供日： ${data.recordDate}`;
  ws.getCell('Y3').value = `作成者： ${data.staffName}`;

  // 2. 明細行差し込み
  // 原紙の行番号とデータの rowNo (1-17) をマッピングする
  const rowMapping: Record<number, number> = {
    // 午前ブロック
    1: 7, 2: 8, 3: 9, 4: 10, 5: 11, 6: 12, 7: 13, 8: 14, 9: 15,
    // 午後ブロック
    10: 18, 11: 19, 12: 20, 13: 21, 14: 22, 15: 23,
    // 外出ブロック
    16: 25, 17: 26
  };

  data.rows.forEach(row => {
    const excelRowNum = rowMapping[row.rowNo];
    if (!excelRowNum) return;

    const excelRow = ws.getRow(excelRowNum);
    
    // カラムマッピング (列文字ではなく列番号 1-indexed)
    // A:1, E:5, K:11, R:18, AA:27
    excelRow.getCell(1).value = row.timeLabel;
    excelRow.getCell(5).value = row.activity;
    excelRow.getCell(11).value = row.personAction;
    excelRow.getCell(18).value = row.supporterAction;
    excelRow.getCell(27).value = row.condition;
  });

  // 3. フッタ差し込み
  ws.getCell('A28').value = data.dailyCarePoints;
  ws.getCell('A30').value = data.otherNotes;
  ws.getCell('A32').value = data.specialNotes;

  // 4. 出力
  const buffer = await wb.xlsx.writeBuffer();
  const dateStr = data.recordDate.replace(/\//g, '');
  const fileName = `支援手順書兼実施記録_${dateStr}_${data.userName}.xlsx`;

  return {
    fileName,
    bytes: buffer as ArrayBuffer,
  };
}
