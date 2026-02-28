/**
 * 生活介護サービス提供実績記録票 — Excel生成
 *
 * テンプレ xlsx をベースにセル差し込みで生成。
 * ExcelJS を使用（ブラウザ互換）。
 *
 * セルマッピング（テンプレ解析結果）:
 *   ヘッダ:
 *     E2: 年月（令和＿＿年＿＿月分）
 *     I4: 受給者証番号
 *     T4: 支給決定障害者氏名
 *     AR4: 事業所番号（事業者名）
 *   日次データ（Row 11～41 = 日:1～31）:
 *     A: 日番号（テンプレにプリセット）
 *     I: サービス提供の状況
 *     N: 開始時間
 *     S: 終了時間
 *     X: 算定時間数
 *     AA: 送迎加算・往
 *     AC: 送迎加算・復
 *     AJ: 食事提供加算
 *     AP: 入浴支援加算
 */
import ExcelJS from 'exceljs';
import type { ServiceProvisionRecord } from '@/features/service-provision/domain/types';
import type { KokuhorenUserProfile } from '@/features/kokuhoren-validation/types';
import { calcDurationMinutes, durationToTimeCode } from '@/features/kokuhoren-validation/derive';

// ─── 入力型 ──────────────────────────────────────────────────

export interface SeikatsuKaigoSheetInput {
  /** YYYY-MM */
  yearMonth: string;
  /** 施設情報 */
  facility: {
    /** 事業所番号 */
    facilityNumber: string;
    /** 事業所名（任意） */
    facilityName?: string;
  };
  /** 利用者 */
  user: KokuhorenUserProfile;
  /** 月内の日次実績 */
  records: ServiceProvisionRecord[];
}

export interface SeikatsuKaigoSheetOutput {
  /** ファイル名 */
  fileName: string;
  /** xlsx バイナリ */
  bytes: ArrayBuffer;
}

// ─── ヘルパー ────────────────────────────────────────────────

const DATA_ROW_START = 11; // Row 11 = 日:1

/** YYYY-MM → '令和XX年XX月分' */
function toWarekiMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const reiwa = y - 2018;
  return `令和${String(reiwa).padStart(2, '　')}年${String(m).padStart(2, '　')}月分`;
}

/** HHMM → "HH:MM" */
function formatHHMM(hhmm: number | null | undefined): string {
  if (hhmm == null) return '';
  const h = Math.floor(hhmm / 100);
  const m = hhmm % 100;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** 日付文字列からその月の日数を取得 */
function daysInMonth(yearMonth: string): number {
  const [y, m] = yearMonth.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** 曜日配列 */
const WEEKDAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

function getWeekday(yearMonth: string, day: number): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const d = new Date(y, m - 1, day);
  return WEEKDAY_NAMES[d.getDay()];
}

// ─── セル差し込みカラム定義 ──────────────────────────────────

/** ExcelJS での列番号（1-indexed） */
const COL = {
  day: 1,       // A
  weekday: 6,   // F
  status: 9,    // I
  start: 14,    // N
  end: 19,      // S
  timeCode: 24, // X
  pickUp: 27,   // AA
  dropOff: 29,  // AC
  meal: 36,     // AJ
  bath: 42,     // AP
} as const;

// ─── メイン生成 ──────────────────────────────────────────────

/**
 * テンプレ xlsx をロードし、セル差し込みで生成
 *
 * @param templateBuffer - テンプレ xlsx のバイナリ
 * @param input - 差し込みデータ
 * @returns 生成された xlsx の ArrayBuffer + fileName
 */
export async function generateSeikatsuKaigoExcel(
  templateBuffer: ArrayBuffer,
  input: SeikatsuKaigoSheetInput,
): Promise<SeikatsuKaigoSheetOutput> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(templateBuffer);

  const ws = wb.worksheets[0];
  if (!ws) throw new Error('テンプレートにワークシートがありません');

  // ── ヘッダ差し込み ─────────────────────────────
  // E2: 年月
  ws.getCell('E2').value = toWarekiMonth(input.yearMonth);
  // I4: 受給者証番号
  ws.getCell('I4').value = input.user.recipientCertNumber ?? '';
  // T4: 氏名
  ws.getCell('T4').value = input.user.userName;
  // AR4: 事業所番号
  ws.getCell('AR4').value = input.facility.facilityNumber;

  // ── レコードを日ごとにマップ ────────────────────
  const recordByDay = new Map<number, ServiceProvisionRecord>();
  for (const r of input.records) {
    const day = parseInt(r.recordDateISO.slice(8, 10), 10);
    recordByDay.set(day, r);
  }

  const maxDay = daysInMonth(input.yearMonth);

  // ── 日次データ差し込み（Row 11 = day 1 → Row 41 = day 31）
  for (let day = 1; day <= 31; day++) {
    const rowNum = DATA_ROW_START + (day - 1);
    const row = ws.getRow(rowNum);

    if (day > maxDay) {
      // その月に存在しない日は空欄（テンプレの日番号もクリア）
      continue;
    }

    // 曜日
    row.getCell(COL.weekday).value = getWeekday(input.yearMonth, day);

    const record = recordByDay.get(day);
    if (!record) continue;

    // 提供状況
    row.getCell(COL.status).value = record.status;

    if (record.status === '提供') {
      // 開始/終了
      row.getCell(COL.start).value = formatHHMM(record.startHHMM);
      row.getCell(COL.end).value = formatHHMM(record.endHHMM);

      // 算定時間コード
      if (record.startHHMM != null && record.endHHMM != null) {
        const duration = calcDurationMinutes(record.startHHMM, record.endHHMM);
        const tc = durationToTimeCode(duration);
        if (tc) row.getCell(COL.timeCode).value = tc;
      }
    }

    // 送迎
    if (record.hasTransportPickup) row.getCell(COL.pickUp).value = 1;
    if (record.hasTransportDropoff) row.getCell(COL.dropOff).value = 1;

    // 加算
    if (record.hasMeal) row.getCell(COL.meal).value = 1;
    if (record.hasBath) row.getCell(COL.bath).value = 1;
  }

  // ── 出力 ───────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const fileName = `生活介護_サービス提供実績記録票_${input.yearMonth.replace('-', '')}_${input.user.userCode}_${input.user.userName}.xlsx`;

  return {
    fileName,
    bytes: buffer as ArrayBuffer,
  };
}
