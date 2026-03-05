/**
 * 生活介護サービス提供実績記録票 — Excel生成（いそかつ書式準拠）
 *
 * テンプレ xlsx をベースにセル差し込みで生成。
 * ExcelJS を使用（ブラウザ互換）。
 *
 * ■ テンプレ: 「いそかつ書式」シート（new実績記録票(自動）2025(R7).xlsm）
 *
 * セルマッピング（いそかつ書式 解析結果）:
 *   ヘッダ:
 *     E5:  年月（serial date → 令和表記はマクロ担当。システムは K5 に月番号）
 *     J6:  受給者証番号（10桁をセル J6〜S6 に1桁ずつ）
 *     T6:  支給決定障害者氏名（AH6 に値）
 *     AS6: 事業所番号（BP6〜BY6 に1桁ずつ）
 *     N9:  契約支給量（日数）
 *   日次データ（Row 14～44 = 日:1～31）:
 *     D:  日付（テンプレにプリセット serial date）
 *     G:  曜日
 *     J:  サービス提供の状況
 *     M:  開始時間（HH部分）  Q: コロン（テンプレ）
 *     V:  終了時間（HH部分）  Z: コロン（テンプレ）
 *     AE: 算定時間数
 *     AI: 送迎加算・往
 *     AK: 送迎加算・復
 *     AR: 食事提供加算
 *     AX: 入浴支援加算
 *     BN: 利用者確認欄
 *     BS: 備考
 */
import { calcDurationMinutes, durationToTimeCode } from '@/features/kokuhoren-validation/derive';
import type { KokuhorenUserProfile } from '@/features/kokuhoren-validation/types';
import type { ServiceProvisionRecord } from '@/features/service-provision/domain/types';
import ExcelJS from 'exceljs';

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

/** いそかつ書式の日次データ開始行（Row 14 = 1日目） */
const DATA_ROW_START = 14;

/** YYYY-MM → '令和XX年XX月分' */
function toWarekiMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  const reiwa = y - 2018;
  return `令和${String(reiwa).padStart(2, '　')}年${String(m).padStart(2, '　')}月分`;
}

/** HHMM → 時間部分と分部分を分離 */
function splitHHMM(hhmm: number | null | undefined): { h: string; m: string } | null {
  if (hhmm == null) return null;
  const h = Math.floor(hhmm / 100);
  const m = hhmm % 100;
  return { h: String(h).padStart(2, '0'), m: String(m).padStart(2, '0') };
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

// ─── いそかつ書式 セル差し込みカラム定義 ─────────────────────

/**
 * ExcelJS での列番号（1-indexed）
 * いそかつ書式シートの解析結果に基づく
 */
const COL = {
  day: 4,        // D — 日付
  weekday: 7,    // G — 曜日
  status: 10,    // J — サービス提供の状況
  startH: 13,    // M — 開始時間（HH部分）
  startM: 18,    // R — 開始時間（MM部分、コロンはQ=17にテンプレ済み）
  endH: 22,      // V — 終了時間（HH部分）
  endM: 27,      // AA — 終了時間（MM部分、コロンはZ=26にテンプレ済み）
  timeCode: 31,  // AE — 算定時間数
  pickUp: 35,    // AI — 送迎加算・往
  dropOff: 37,   // AK — 送迎加算・復
  meal: 44,      // AR — 食事提供加算
  bath: 50,      // AX — 入浴支援加算
  userConfirm: 66, // BN — 利用者確認欄
  note: 71,      // BS — 備考
} as const;

// ─── メイン生成 ──────────────────────────────────────────────

/**
 * テンプレ xlsx をロードし、セル差し込みで生成（いそかつ書式準拠）
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

  // いそかつ書式シートを使用（シート名で検索、なければ最初のシート）
  const ws = wb.worksheets.find(s => s.name.includes('いそかつ')) ?? wb.worksheets[0];
  if (!ws) throw new Error('テンプレートにワークシートがありません');

  // ── ヘッダ差し込み ─────────────────────────────
  // E5: 年月（令和表記）
  ws.getCell('E5').value = toWarekiMonth(input.yearMonth);
  // K5: 月番号
  const [, monthNum] = input.yearMonth.split('-').map(Number);
  ws.getCell('K5').value = monthNum;

  // T6 (col 19+1=20): 氏名 → AH6 (col 34)
  ws.getCell('AH6').value = input.user.userName;

  // 受給者証番号: J6〜S6 に1桁ずつ（10桁）
  const certNum = (input.user.recipientCertNumber ?? '').padStart(10, '0');
  for (let i = 0; i < 10; i++) {
    ws.getRow(6).getCell(10 + i).value = parseInt(certNum[i], 10); // J=10, K=11, ..., S=19
  }

  // 事業所番号: BP6〜BY6 に1桁ずつ（10桁）
  const facNum = input.facility.facilityNumber.padStart(10, '0');
  for (let i = 0; i < 10; i++) {
    ws.getRow(6).getCell(68 + i).value = parseInt(facNum[i], 10); // BP=68, BQ=69, ..., BY=77
  }

  // 事業所名: BG8
  if (input.facility.facilityName) {
    ws.getCell('BG8').value = input.facility.facilityName;
  }

  // ── レコードを日ごとにマップ ────────────────────
  const recordByDay = new Map<number, ServiceProvisionRecord>();
  for (const r of input.records) {
    const day = parseInt(r.recordDateISO.slice(8, 10), 10);
    recordByDay.set(day, r);
  }

  const maxDay = daysInMonth(input.yearMonth);

  // ── 日次データ差し込み（Row 14 = day 1 → Row 44 = day 31）
  for (let day = 1; day <= 31; day++) {
    const rowNum = DATA_ROW_START + (day - 1);
    const row = ws.getRow(rowNum);

    if (day > maxDay) {
      // その月に存在しない日は空欄
      continue;
    }

    // 曜日
    row.getCell(COL.weekday).value = getWeekday(input.yearMonth, day);

    const record = recordByDay.get(day);
    if (!record) continue;

    // 提供状況
    row.getCell(COL.status).value = record.status;

    if (record.status === '提供') {
      // 開始時間（HH:MM を分割して配置）
      const startParts = splitHHMM(record.startHHMM);
      if (startParts) {
        row.getCell(COL.startH).value = startParts.h;
        row.getCell(COL.startM).value = startParts.m;
      }

      // 終了時間
      const endParts = splitHHMM(record.endHHMM);
      if (endParts) {
        row.getCell(COL.endH).value = endParts.h;
        row.getCell(COL.endM).value = endParts.m;
      }

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

    // 備考
    if (record.note) row.getCell(COL.note).value = record.note;
  }

  // ── 出力 ───────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const fileName = `生活介護_サービス提供実績記録票_${input.yearMonth.replace('-', '')}_${input.user.userCode}_${input.user.userName}.xlsx`;

  return {
    fileName,
    bytes: buffer as ArrayBuffer,
  };
}
