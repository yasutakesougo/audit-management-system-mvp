// ---------------------------------------------------------------------------
// parseSupportTemplateCsv — SupportTemplate CSV → ProcedureItem[] 変換
//
// SharePoint SupportTemplates リストからエクスポートされた CSV を
// ProcedureItem（時間割）に変換する純粋関数。
// ---------------------------------------------------------------------------
import Papa from 'papaparse';

import type { ScheduleItem } from '@/features/daily/components/split-stream/ProcedurePanel';
import type { ImportResult, SupportTemplateCsvRow } from './csvImportTypes';

/**
 * SupportTemplate CSV 文字列をパースし、ユーザーコード別の ProcedureItem 配列を返す。
 *
 * @param csvString - UTF-8 の CSV テキスト
 * @returns ユーザーコード → ProcedureItem[] の Map、スキップ数、総行数
 *
 * @example
 * ```ts
 * const file = await fileInput.files[0].text();
 * const result = parseSupportTemplateCsv(file);
 * // result.data.get('I001') → [{ time: '09:00', activity: '朝の受け入れ', ... }]
 * ```
 */
export function parseSupportTemplateCsv(csvString: string): ImportResult<ScheduleItem> {
  const parsed = Papa.parse<SupportTemplateCsvRow>(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  const data = new Map<string, ScheduleItem[]>();
  let skippedRows = 0;

  for (const row of parsed.data) {
    const userCode = row.UserCode?.trim();
    const timeSlot = row['時間帯']?.trim();
    const activity = row['活動内容']?.trim();

    // 必須フィールドが欠けている行はスキップ
    if (!userCode || !timeSlot || !activity) {
      skippedRows++;
      continue;
    }

    const personManual = row['本人の動き']?.trim() ?? '';
    const supporterManual = row['支援者の動き']?.trim() ?? '';
    const rowNo = parseInt(row.RowNo, 10) || 0;

    // activity + personManual を結合（どちらか空ならスキップ）
    const activityLabel = personManual
      ? `${activity} - ${personManual}`
      : activity;

    const item: ScheduleItem = {
      id: `csv-${userCode}-${rowNo}`,
      time: normalizeTimeSlot(timeSlot),
      activity: activityLabel,
      instruction: supporterManual,
      isKey: false,
      linkedInterventionIds: [],
    };

    if (!data.has(userCode)) {
      data.set(userCode, []);
    }
    data.get(userCode)!.push(item);
  }

  // RowNo 順にソート
  for (const [, items] of data) {
    items.sort((a, b) => a.time.localeCompare(b.time));
  }

  return {
    data,
    skippedRows,
    totalRows: parsed.data.length,
  };
}

// ---------------------------------------------------------------------------
// Time slot normalization
// ---------------------------------------------------------------------------

/**
 * 自由書式の時間帯文字列を "HH:MM" 形式に正規化する。
 *
 * 入力例: "9:30〜10:30", "12:40～13:45", "9:30頃", "09:30"
 * 出力例: "09:30", "12:40", "09:30", "09:30"
 */
export function normalizeTimeSlot(raw: string): string {
  // 先頭の時刻部分を抽出
  const match = raw.match(/(\d{1,2})\s*[:：]\s*(\d{2})/);
  if (!match) return raw; // パースできなければそのまま返す

  const hour = match[1].padStart(2, '0');
  const minute = match[2];
  return `${hour}:${minute}`;
}
