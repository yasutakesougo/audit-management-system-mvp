/**
 * generateSupportProcedureExcel — Unit Tests
 *
 * ExcelJS ベースの支援手順書兼実施記録出力ルートを直接検証する。
 */
import type { DailySupportProcedureDocument } from '@/features/planning-sheet/domain/dailySupportProcedure';
import { generateSupportProcedureExcel } from '@/features/official-forms/generateSupportProcedureExcel';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

async function createMinimalTemplate(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('template');

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

const baseDocument: DailySupportProcedureDocument = {
  title: '支援手順書',
  userName: 'テスト太郎',
  recordDate: '2026/07/01',
  staffName: '加藤 職員',
  dailyCarePoints: '特記事項A',
  otherNotes: 'その他',
  specialNotes: '重要備考',
  rows: [
    {
      rowNo: 1,
      block: 'morning',
      timeLabel: '9:00',
      activity: '通所・朝の準備',
      personAction: '入浴',
      supporterAction: '見守り',
      condition: '安定',
      specialNote: '特記事項',
    },
    {
      rowNo: 10,
      block: 'afternoon',
      timeLabel: '13:00',
      activity: '昼食',
      personAction: '食事',
      supporterAction: '介助',
      condition: '快調',
      specialNote: '活動継続',
    },
  ],
};

describe('generateSupportProcedureExcel', () => {
  it('returns an xlsx ArrayBuffer and expected filename', async () => {
    const template = await createMinimalTemplate();
    const result = await generateSupportProcedureExcel(template, baseDocument);

    expect(result.fileName).toContain('支援手順書兼実施記録');
    expect(result.fileName).toContain('20260701');
    expect(result.fileName).toContain('テスト太郎');
    expect(result.fileName).toMatch(/\.xlsx$/);
    expect(result.bytes).toBeTruthy();
    expect(result.bytes.byteLength ?? (result.bytes as unknown as { length?: number }).length).toBeGreaterThan(0);
  });

  it('maps header and row fields into expected workbook cells', async () => {
    const template = await createMinimalTemplate();
    const result = await generateSupportProcedureExcel(template, baseDocument);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result.bytes);
    const ws = wb.worksheets[0];

    expect(ws.getCell('A2').value).toBe(`利用者氏名： ${baseDocument.userName}`);
    expect(ws.getCell('A3').value).toBe(`サービス提供日： ${baseDocument.recordDate}`);
    expect(ws.getCell('Y3').value).toBe(`作成者： ${baseDocument.staffName}`);

    expect(ws.getCell('A7').value).toBe(baseDocument.rows[0].timeLabel);
    expect(ws.getCell('E7').value).toBe(baseDocument.rows[0].activity);
    expect(ws.getCell('K7').value).toBe(baseDocument.rows[0].personAction);
    expect(ws.getCell('R7').value).toBe(baseDocument.rows[0].supporterAction);
    expect(ws.getCell('AA7').value).toBe(baseDocument.rows[0].condition);
    expect(ws.getCell('A28').value).toBe(baseDocument.dailyCarePoints);
    expect(ws.getCell('A30').value).toBe(baseDocument.otherNotes);
    expect(ws.getCell('A32').value).toBe(baseDocument.specialNotes);
  });

  it('throws when template has no worksheet', async () => {
    const wb = new ExcelJS.Workbook();
    const emptyBuffer = await wb.xlsx.writeBuffer();

    await expect(
      generateSupportProcedureExcel(emptyBuffer as ArrayBuffer, baseDocument),
    ).rejects.toThrow('テンプレートにワークシートがありません');
  });
});
