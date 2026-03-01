// ---------------------------------------------------------------------------
// parseCarePointsCsv — CarePoints CSV → BehaviorInterventionPlan[] 変換
//
// SharePoint CarePoints リストからエクスポートされた CSV を
// BIPドラフト（行動対応プラン下書き）に変換する純粋関数。
// ---------------------------------------------------------------------------
import Papa from 'papaparse';

import type { BehaviorInterventionPlan } from '@/features/analysis/domain/interventionTypes';
import { createEmptyStrategies } from '@/features/analysis/domain/interventionTypes';
import type { CarePointCsvRow, ImportResult } from './csvImportTypes';

/** PointText からタイトルを抽出する（冒頭 N文字） */
const TITLE_MAX_LENGTH = 20;

function extractTitle(text: string): string {
  const cleaned = text.replace(/[\n\r]/g, ' ').trim();
  if (cleaned.length <= TITLE_MAX_LENGTH) return cleaned;
  return `${cleaned.slice(0, TITLE_MAX_LENGTH)}…`;
}

/**
 * CarePoints CSV 文字列をパースし、ユーザーコード別の BIP ドラフト配列を返す。
 *
 * テキスト全文を `strategies.prevention`（予防的対応）に初期投入し、
 * `targetBehavior` にテキスト冒頭20文字を設定する。
 * 後から現場スタッフが3列フォーム（BIPダッシュボード）で構造化する運用。
 *
 * @param csvString - UTF-8 の CSV テキスト
 * @returns ユーザーコード → BehaviorInterventionPlan[] の Map
 *
 * @example
 * ```ts
 * const result = parseCarePointsCsv(csvText);
 * // result.data.get('I001') → [{ targetBehavior: 'はさみへのこだわりがある...', ... }]
 * ```
 */
export function parseCarePointsCsv(csvString: string): ImportResult<BehaviorInterventionPlan> {
  const parsed = Papa.parse<CarePointCsvRow>(csvString, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header) => header.trim(),
  });

  const data = new Map<string, BehaviorInterventionPlan[]>();
  let skippedRows = 0;

  for (const row of parsed.data) {
    const userCode = row.Usercode?.trim();
    const pointText = row.PointText?.trim();
    // IsActive が明示的に "0" や "false" ならスキップ
    const isActive = row.IsActive?.trim();
    if (isActive === '0' || isActive?.toLowerCase() === 'false') {
      skippedRows++;
      continue;
    }

    if (!userCode || !pointText) {
      skippedRows++;
      continue;
    }

    const planIndex = data.get(userCode)?.length ?? 0;

    const plan: BehaviorInterventionPlan = {
      id: `csv-care-${userCode}-${planIndex}`,
      userId: userCode,
      targetBehavior: extractTitle(pointText),
      targetBehaviorNodeId: `csv-import-${userCode}-${planIndex}`,
      triggerFactors: [],
      strategies: {
        ...createEmptyStrategies(),
        prevention: pointText, // 全文を予防的対応に初期投入
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (!data.has(userCode)) {
      data.set(userCode, []);
    }
    data.get(userCode)!.push(plan);
  }

  return {
    data,
    skippedRows,
    totalRows: parsed.data.length,
  };
}
