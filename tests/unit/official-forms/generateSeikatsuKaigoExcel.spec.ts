/**
 * generateSeikatsuKaigoExcel — Unit Tests
 *
 * テンプレ xlsx をインメモリで生成し、セル差し込みの正確性を検証。
 */
import type { SeikatsuKaigoSheetInput } from '@/features/official-forms/generateSeikatsuKaigoExcel';
import { generateSeikatsuKaigoExcel } from '@/features/official-forms/generateSeikatsuKaigoExcel';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

// ─── テンプレート生成ヘルパー ─────────────────────────────────

/**
 * テスト用の最小テンプレ xlsx を ExcelJS でインメモリ生成
 * Row 14～44 がデータ行という前提でワークシートを作る
 */
async function createMinimalTemplate(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('いそかつ書式'); // テンプレートには「いそかつ」を含む名前が必要

  // ヘッダ行のプレースホルダー
  ws.getCell('E5').value = '';
  ws.getCell('AH6').value = '';
  ws.getCell('J6').value = '';
  ws.getCell('BP6').value = '';

  // データ行（Row 14 = day 1 → Row 44 = day 31）
  for (let day = 1; day <= 31; day++) {
    const rowNum = 14 + (day - 1);
    ws.getRow(rowNum).getCell(4).value = day; // D列 (col 4): 日番号
  }

  const buffer = await wb.xlsx.writeBuffer();
  return buffer as ArrayBuffer;
}

// ─── 入力フィクスチャ ─────────────────────────────────────────

const baseInput: SeikatsuKaigoSheetInput = {
  yearMonth: '2026-02',
  facility: {
    facilityNumber: '1234567890',
    facilityName: 'テスト事業所',
  },
  user: {
    userCode: 'I022',
    userName: 'テスト太郎',
    recipientCertNumber: '0987654321', // 10 chars
  },
  records: [],
};

// ─── テスト ───────────────────────────────────────────────────

describe('generateSeikatsuKaigoExcel', () => {
  it('returns an xlsx ArrayBuffer with correct fileName', async () => {
    const template = await createMinimalTemplate();
    const result = await generateSeikatsuKaigoExcel(template, baseInput);

    expect(result.fileName).toContain('生活介護');
    expect(result.fileName).toContain('202602');
    expect(result.fileName).toContain('I022');
    expect(result.fileName).toContain('テスト太郎');
    expect(result.fileName).toMatch(/\.xlsx$/);
    // ExcelJS writeBuffer returns Node.js Buffer in test env
    expect(result.bytes).toBeTruthy();
    expect((result.bytes as unknown as { byteLength?: number; length?: number }).byteLength ?? (result.bytes as unknown as { length?: number }).length).toBeGreaterThan(0);
  });

  it('populates header cells correctly', async () => {
    const template = await createMinimalTemplate();
    const result = await generateSeikatsuKaigoExcel(template, baseInput);

    // 出力ファイルを ExcelJS で再読み込みして検証
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result.bytes);
    const ws = wb.worksheets[0];

    // E5: 令和年月
    const yearMonthCell = String(ws.getCell('E5').value);
    expect(yearMonthCell).toContain('令和');
    expect(yearMonthCell).toContain('年');
    expect(yearMonthCell).toContain('月分');

    // 受給者証番号 (J6〜S6 に1字ずつ)
    const certNum = '0987654321';
    for (let i = 0; i < 10; i++) {
        expect(ws.getRow(6).getCell(10 + i).value).toBe(parseInt(certNum[i], 10)); // J=10
    }

    // AH6: 氏名
    expect(ws.getCell('AH6').value).toBe('テスト太郎');

    // 事業所番号 (BP6〜BY6 に1字ずつ)
    const facNum = '1234567890';
    for (let i = 0; i < 10; i++) {
        expect(ws.getRow(6).getCell(68 + i).value).toBe(parseInt(facNum[i], 10)); // BP=68
    }

    // BG8: 事業所名
    expect(ws.getCell('BG8').value).toBe('テスト事業所');
  });

  it('populates daily records for "提供" status', async () => {
    const template = await createMinimalTemplate();
    const input: SeikatsuKaigoSheetInput = {
      ...baseInput,
      records: [
        {
          id: 1,
          entryKey: 'I022|2026-02-05',
          userCode: 'I022',
          recordDateISO: '2026-02-05',
          status: '提供',
          startHHMM: 930,
          endHHMM: 1530,
          hasTransportPickup: true,
          hasTransportDropoff: true,
          hasMeal: true,
          hasBath: false,
        },
      ],
    };

    const result = await generateSeikatsuKaigoExcel(template, input);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result.bytes);
    const ws = wb.worksheets[0];

    // Day 5 = Row 18 (14 + 5 - 1)
    const row18 = ws.getRow(18);

    // J列 (col 10): ステータス
    expect(row18.getCell(10).value).toBe('提供');

    // M列 (col 13): 開始時間H
    expect(row18.getCell(13).value).toBe('09');
    // R列 (col 18): 開始時間M
    expect(row18.getCell(18).value).toBe('30');

    // V列 (col 22): 終了時間H
    expect(row18.getCell(22).value).toBe('15');
    // AA列 (col 27): 終了時間M
    expect(row18.getCell(27).value).toBe('30');

    // AE列 (col 31): 算定時間コード（930→1530 = 360分 = 6h → コード05等）※derive ロジックによる
    expect(row18.getCell(31).value).toBe('05');

    // AI列 (col 35): 送迎加算・往
    expect(row18.getCell(35).value).toBe(1);

    // AK列 (col 37): 送迎加算・復
    expect(row18.getCell(37).value).toBe(1);

    // AR列 (col 44): 食事
    expect(row18.getCell(44).value).toBe(1);

    // AX列 (col 50): 入浴支援加算 — false なので未設定
    expect(row18.getCell(50).value).not.toBe(1);
  });

  it('populates daily records for "欠席" status (no times/timeCode)', async () => {
    const template = await createMinimalTemplate();
    const input: SeikatsuKaigoSheetInput = {
      ...baseInput,
      records: [
        {
          id: 2,
          entryKey: 'I022|2026-02-10',
          userCode: 'I022',
          recordDateISO: '2026-02-10',
          status: '欠席',
        },
      ],
    };

    const result = await generateSeikatsuKaigoExcel(template, input);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result.bytes);
    const ws = wb.worksheets[0];

    // Day 10 = Row 23 (14 + 10 - 1)
    const row23 = ws.getRow(23);

    // ステータスは記録される
    expect(row23.getCell(10).value).toBe('欠席');

    // 時間系は空
    expect(row23.getCell(13).value).toBeFalsy(); // startH
    expect(row23.getCell(22).value).toBeFalsy(); // endH
    expect(row23.getCell(31).value).toBeFalsy(); // timeCode
  });

  it('handles empty records (no data rows populated)', async () => {
    const template = await createMinimalTemplate();
    const result = await generateSeikatsuKaigoExcel(template, {
      ...baseInput,
      records: [],
    });

    expect(result.bytes.byteLength).toBeGreaterThan(0);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result.bytes);
    const ws = wb.worksheets[0];

    // ヘッダは設定される
    expect(ws.getCell('AH6').value).toBe('テスト太郎');

    // データ行は空
    expect(ws.getRow(18).getCell(10).value).toBeFalsy();
  });

  it('handles February correctly (28/29 days)', async () => {
    const template = await createMinimalTemplate();
    const input: SeikatsuKaigoSheetInput = {
      ...baseInput,
      yearMonth: '2026-02', // 2026年2月は28日まで
      records: [
        {
          id: 3,
          entryKey: 'I022|2026-02-28',
          userCode: 'I022',
          recordDateISO: '2026-02-28',
          status: '提供',
          startHHMM: 930,
          endHHMM: 1530,
        },
      ],
    };

    const result = await generateSeikatsuKaigoExcel(template, input);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result.bytes);
    const ws = wb.worksheets[0];

    // Day 28 = Row 41 (14 + 28 - 1) — should have data
    expect(ws.getRow(41).getCell(10).value).toBe('提供');

    // Day 29～31 はその月に存在しないので空欄のまま
    // (テンプレの日番号もクリアされないが、recordもないので status は入らない)
  });

  it('令和変換: 2026-02 → 令和 8年 2月分', async () => {
    const template = await createMinimalTemplate();
    const result = await generateSeikatsuKaigoExcel(template, {
      ...baseInput,
      yearMonth: '2026-02',
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result.bytes);
    const ws = wb.worksheets[0];

    const warekiValue = String(ws.getCell('E5').value);
    expect(warekiValue).toContain('8');
    expect(warekiValue).toContain('2');
    expect(warekiValue).toContain('月分');
  });

  it('populates weekday for each day correctly', async () => {
    const template = await createMinimalTemplate();
    const result = await generateSeikatsuKaigoExcel(template, {
      ...baseInput,
      yearMonth: '2026-02',
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result.bytes);
    const ws = wb.worksheets[0];

    // 2026-02-01 is Sunday (日)
    const row14 = ws.getRow(14);
    expect(row14.getCell(7).value).toBe('日');

    // 2026-02-02 is Monday (月)
    const row15 = ws.getRow(15);
    expect(row15.getCell(7).value).toBe('月');
  });

  it('throws if template has no worksheet', async () => {
    const emptyWb = new ExcelJS.Workbook();
    const emptyBuffer = await emptyWb.xlsx.writeBuffer();

    await expect(
      generateSeikatsuKaigoExcel(emptyBuffer as ArrayBuffer, baseInput)
    ).rejects.toThrow('テンプレートにワークシートがありません');
  });

  it('handles user without recipientCertNumber', async () => {
    const template = await createMinimalTemplate();
    const result = await generateSeikatsuKaigoExcel(template, {
      ...baseInput,
      user: { userCode: 'I099', userName: '証番号なし', recipientCertNumber: null },
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(result.bytes);
    const ws = wb.worksheets[0];

    // 受給者証番号が空埋めによる0になる (implementation pads null to '0000000000')
    expect(ws.getRow(6).getCell(10).value).toBe(0);
  });
});
