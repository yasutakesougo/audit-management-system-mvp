/**
 * buildImportPreview.ts — 特性アンケート取込の差分プレビューを生成する Pure Function
 *
 * tokuseiToPlanningBridge() の結果と現在のフォーム値を比較し、
 * 表示用のプレビューアイテム配列を生成する。
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** 各フィールドの反映タイプ */
export type ImportAction = 'new' | 'append' | 'skip';

/** プレビューアイテム: 1フィールドの取込予定を表す */
export interface ImportPreviewItem {
  /** フォームフィールドのキー */
  fieldKey: string;
  /** 表示用のフィールド名 */
  fieldLabel: string;
  /** 所属セクション（§番号） */
  section: string;
  /** 反映タイプ */
  action: ImportAction;
  /** 入力される値（追記マーカー含まない純粋な値） */
  incomingValue: string;
  /** 既存のフォーム値（action='append' の場合のみ有効） */
  currentValue: string;
}

/** プレビュー全体のサマリー */
export interface ImportPreviewSummary {
  /** 新規入力されるフィールド数 */
  newCount: number;
  /** 追記されるフィールド数 */
  appendCount: number;
  /** スキップされるフィールド数（入力値なし） */
  skipCount: number;
  /** 反映される合計フィールド数 */
  totalAffected: number;
}

/** buildImportPreview() の戻り値 */
export interface ImportPreviewResult {
  items: ImportPreviewItem[];
  summary: ImportPreviewSummary;
}

// ---------------------------------------------------------------------------
// Field label mapping
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, { label: string; section: string }> = {
  // §2 対象行動
  targetBehavior: { label: '対象行動', section: '§2 対象行動' },
  behaviorFrequency: { label: '発生頻度', section: '§2 対象行動' },
  behaviorSituation: { label: '発生場面', section: '§2 対象行動' },
  behaviorDuration: { label: '継続時間', section: '§2 対象行動' },
  behaviorIntensity: { label: '強度', section: '§2 対象行動' },
  behaviorRisk: { label: '危険性', section: '§2 対象行動' },
  behaviorImpact: { label: '影響', section: '§2 対象行動' },
  // §3 氷山分析
  triggers: { label: 'トリガー（きっかけ）', section: '§3 氷山分析' },
  environmentFactors: { label: '環境要因', section: '§3 氷山分析' },
  emotions: { label: '本人の感情', section: '§3 氷山分析' },
  cognition: { label: '理解状況（認知）', section: '§3 氷山分析' },
  needs: { label: '本人ニーズ', section: '§3 氷山分析' },
  // §4 FBA
  behaviorFunctionDetail: { label: '機能の詳細分析', section: '§4 FBA' },
  abcAntecedent: { label: 'A: 先行事象', section: '§4 FBA' },
  abcBehavior: { label: 'B: 行動', section: '§4 FBA' },
  abcConsequence: { label: 'C: 結果', section: '§4 FBA' },
  // §5 予防的支援
  environmentalAdjustment: { label: '環境調整', section: '§5 予防的支援' },
  visualSupport: { label: '見通し支援', section: '§5 予防的支援' },
  communicationSupport: { label: 'コミュニケーション支援', section: '§5 予防的支援' },
  safetySupport: { label: '安心支援', section: '§5 予防的支援' },
  preSupport: { label: '事前支援', section: '§5 予防的支援' },
  // §8 危機対応
  dangerousBehavior: { label: '危険行動', section: '§8 危機対応' },
  medicalCoordination: { label: '医療連携', section: '§8 危機対応' },
};

// ---------------------------------------------------------------------------
// Pure Function
// ---------------------------------------------------------------------------

/**
 * 特性アンケート取込の差分プレビューを生成する。
 *
 * @param formPatches - tokuseiToPlanningBridge() の formPatches
 * @param currentFormValues - 現在のフォーム値（キーは string 型のフィールドのみ）
 * @returns 表示用のプレビューアイテム配列とサマリー
 */
export function buildImportPreview(
  formPatches: Record<string, string>,
  currentFormValues: Record<string, unknown>,
): ImportPreviewResult {
  const items: ImportPreviewItem[] = [];

  for (const [key, incoming] of Object.entries(formPatches)) {
    if (!incoming || typeof incoming !== 'string' || !incoming.trim()) continue;

    const meta = FIELD_LABELS[key];
    if (!meta) continue; // マッピングにないフィールドはスキップ

    const current = currentFormValues[key];
    const currentStr = typeof current === 'string' ? current.trim() : '';

    const action: ImportAction = currentStr ? 'append' : 'new';

    items.push({
      fieldKey: key,
      fieldLabel: meta.label,
      section: meta.section,
      action,
      incomingValue: incoming.trim(),
      currentValue: currentStr,
    });
  }

  // セクション順でソート
  items.sort((a, b) => a.section.localeCompare(b.section, 'ja'));

  const newCount = items.filter(i => i.action === 'new').length;
  const appendCount = items.filter(i => i.action === 'append').length;

  return {
    items,
    summary: {
      newCount,
      appendCount,
      skipCount: 0,
      totalAffected: newCount + appendCount,
    },
  };
}
