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
 * Row 11～41 がデータ行という前提でワークシートを作る
 */
async function createMinimalTemplate(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');

  // ヘッダ行のプレースホルダー
  ws.getCell('E2').value = '';
  ws.getCell('I4').value = '';
  ws.getCell('T4').value = '';
  ws.getCell('AR4').value = '';

  // データ行（Row 11 = day 1 → Row 41 = day 31）
  for (let day = 1; day <= 31; day++) {
    const rowNum = 11 + (day - 1);
    ws.getRow(rowNum).getCell(1).value = day; // A列: 日番号
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
    recipientCertNumber: '1234567890',
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

    // E2: 令和年月
    const yearMonthCell = String(ws.getCell('E2').value);
    expect(yearMonthCell).toContain('令和');
    expect(yearMonthCell).toContain('年');
    expect(yearMonthCell).toContain('月分');

    // I4: 受給者証番号
    expect(ws.getCell('I4').value).toBe('1234567890');

    // T4: 氏名
    expect(ws.getCell('T4').value).toBe('テスト太郎');

    // AR4: 事業所番号
    expect(ws.getCell('AR4').value).toBe('1234567890');
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

    // Day 5 = Row 15 (11 + 5 - 1)
    const row15 = ws.getRow(15);

    // I列 (col 9): ステータス
    expect(row15.getCell(9).value).toBe('提供');

    // N列 (col 14): 開始時間
    expect(row15.getCell(14).value).toBe('09:30');

    // S列 (col 19): 終了時間
    expect(row15.getCell(19).value).toBe('15:30');

    // X列 (col 24): 算定時間コード（930→1530 = 360分 = 6h → コード05）
    expect(row15.getCell(24).value).toBe('05');

    // AA列 (col 27): 送迎・往
    expect(row15.getCell(27).value).toBe(1);

    // AC列 (col 29): 送迎・復
    expect(row15.getCell(29).value).toBe(1);

    // AJ列 (col 36): 食事
    expect(row15.getCell(36).value).toBe(1);

    // AP列 (col 42): 入浴 — false なので未設定
    expect(row15.getCell(42).value).not.toBe(1);
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

    // Day 10 = Row 20
    const row20 = ws.getRow(20);

    // ステータスは記録される
    expect(row20.getCell(9).value).toBe('欠席');

    // 時間系は空
    expect(row20.getCell(14).value).toBeFalsy(); // start
    expect(row20.getCell(19).value).toBeFalsy(); // end
    expect(row20.getCell(24).value).toBeFalsy(); // timeCode
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
    expect(ws.getCell('T4').value).toBe('テスト太郎');

    // データ行は空
    expect(ws.getRow(15).getCell(9).value).toBeFalsy();
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

    // Day 28 = Row 38 — should have data
    expect(ws.getRow(38).getCell(9).value).toBe('提供');

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

    const warekiValue = String(ws.getCell('E2').value);
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
    const row11 = ws.getRow(11);
    expect(row11.getCell(6).value).toBe('日');

    // 2026-02-02 is Monday (月)
    const row12 = ws.getRow(12);
    expect(row12.getCell(6).value).toBe('月');
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

    // 受給者証番号が空文字になる
    expect(ws.getCell('I4').value).toBe('');
  });
});
