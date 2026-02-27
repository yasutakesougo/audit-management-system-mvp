/**
 * 国保連CSV — 様式71生成（サービス提供実績記録票）
 *
 * 純粋関数。MonthlyProvisionInput → CSV文字列。
 * 列定義で引用符を物理強制。
 */
import type { CsvColumnDef, CsvRowValues } from './types';
import type { MonthlyProvisionInput, DailyProvisionEntry, KokuhorenUserProfile } from '@/features/kokuhoren-validation/types';
import { deriveProvisionEntry } from '@/features/kokuhoren-validation/derive';
import { serializeRows } from './serializer';

// ─── 列定義（様式71骨格） ────────────────────────────────────

/**
 * MVP列セット — 返戻事故が起きやすい列を優先
 *
 * 列番号は国保連仕様書の列位置に対応（参考用）
 */
export const CSV71_COLUMNS: CsvColumnDef[] = [
  { key: 'recordType',      label: 'レコード種別',     kind: 'number' }, // 1
  { key: 'certNumber',      label: '受給者証番号',     kind: 'string' }, // 5
  { key: 'provisionDay',    label: '提供日',           kind: 'number' }, // 7
  { key: 'serviceCode',     label: 'サービス内容',     kind: 'string' }, // 8
  { key: 'startHHMM',       label: '開始時刻',         kind: 'number' }, // 9
  { key: 'endHHMM',         label: '終了時刻',         kind: 'number' }, // 10
  { key: 'timeCode',        label: '算定時間コード',   kind: 'string' }, // 11
  { key: 'transportPickup',  label: '送迎加算・往',     kind: 'string' }, // 12a
  { key: 'transportDropoff', label: '送迎加算・復',     kind: 'string' }, // 12b
  { key: 'mealFlag',         label: '食事提供加算',     kind: 'string' }, // 13
  { key: 'bathFlag',         label: '入浴支援',         kind: 'string' }, // 20
];

// ─── ヘルパー ────────────────────────────────────────────────

/** ステータス → サービス内容コード */
function toServiceCode(status: '提供' | '欠席' | 'その他'): string {
  switch (status) {
    case '提供': return '1';
    case '欠席': return '2';
    case 'その他': return '9';
  }
}

/** recordDateISO ("2026-02-15") → 日(15) */
function extractDay(recordDateISO: string): number {
  return parseInt(recordDateISO.slice(8, 10), 10);
}

// ─── 行変換 ──────────────────────────────────────────────────

function toRow(
  record: DailyProvisionEntry,
  userProfile: KokuhorenUserProfile | undefined,
): CsvRowValues {
  const derived = deriveProvisionEntry(record);
  const isProvided = record.status === '提供';

  return {
    recordType: 71,
    certNumber: userProfile?.recipientCertNumber ?? '',
    provisionDay: extractDay(record.recordDateISO),
    serviceCode: toServiceCode(record.status),
    startHHMM: isProvided ? (record.startHHMM ?? null) : null,
    endHHMM: isProvided ? (record.endHHMM ?? null) : null,
    timeCode: isProvided ? (derived.timeCode ?? '') : '',
    transportPickup: record.hasTransportPickup ? '1' : '',
    transportDropoff: record.hasTransportDropoff ? '1' : '',
    mealFlag: record.hasMeal ? '1' : '',
    bathFlag: record.hasBath ? '1' : '',
  };
}

// ─── メインAPI ───────────────────────────────────────────────

/**
 * 様式71 CSV を生成
 *
 * @returns CSV文字列（CRLF, UTF-8）
 */
export function generateKokuhorenCsv71(input: MonthlyProvisionInput): string {
  const userMap = new Map<string, KokuhorenUserProfile>();
  for (const user of input.users) {
    userMap.set(user.userCode, user);
  }

  // ユーザーコード→日付順にソート
  const sorted = [...input.records].sort((a, b) => {
    const userCmp = a.userCode.localeCompare(b.userCode);
    if (userCmp !== 0) return userCmp;
    return a.recordDateISO.localeCompare(b.recordDateISO);
  });

  const rows: CsvRowValues[] = sorted.map((record) =>
    toRow(record, userMap.get(record.userCode)),
  );

  return serializeRows(CSV71_COLUMNS, rows);
}

/**
 * CSV ファイル名を生成
 * 例: KOKU_71_202602.csv
 */
export function generateCsvFilename(yearMonth: string): string {
  return `KOKU_71_${yearMonth.replace('-', '')}.csv`;
}
