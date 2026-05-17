import type { ImportAuditRecord } from './stores/importAuditStore';
import type { TokuseiBridgeResult } from './tokuseiToPlanningBridge';

/**
 * Tokusei 取込の監査情報を生成するためのペイロード。
 * ImportAuditStore.saveAuditRecord の引数となる。
 */
export type TokuseiImportAuditPayload = Omit<ImportAuditRecord, 'id'>;

export interface TokuseiAuditBuilderOptions {
  planningSheetId: string;
  importedBy: string;
  tokuseiResponseId: string;
  bridgeResult: TokuseiBridgeResult;
  /**
   * 取込日時（省略時は現在時刻）
   */
  now?: string;
}

/**
 * TokuseiBridgeResult から ImportAuditRecord の保存用ペイロードを構築する pure function。
 * Iceberg audit trail とは別 mode ('with-tokusei') として責務を分離する。
 *
 * @param options - 構築に必要なオプション
 * @returns 監査用ペイロード
 */
export function buildTokuseiImportAuditPayload(
  options: TokuseiAuditBuilderOptions,
): TokuseiImportAuditPayload {
  const { planningSheetId, importedBy, tokuseiResponseId, bridgeResult, now } = options;
  const importedAt = now || new Date().toISOString();

  // audit.fieldsTouched を対象フィールドとして記録
  const affectedFields = [...bridgeResult.audit.fieldsTouched];

  // サマリーテキストの生成
  const { summary } = bridgeResult;
  const summaryParts: string[] = [];
  if (summary.icebergFieldsFilled > 0) summaryParts.push(`氷山分析: ${summary.icebergFieldsFilled}件`);
  if (summary.sensoryTriggersAdded > 0) summaryParts.push(`感覚トリガー: ${summary.sensoryTriggersAdded}件`);
  if (summary.targetBehaviorCandidates > 0) summaryParts.push(`対象行動候補: ${summary.targetBehaviorCandidates}件`);
  if (summary.hypothesesGenerated > 0) summaryParts.push(`機能仮説候補: ${summary.hypothesesGenerated}件`);

  const summaryText = summaryParts.length > 0
    ? `特性アンケート取込 (${summaryParts.join(' / ')})`
    : '特性アンケート取込 (反映データなし)';

  // TokuseiProvenanceEntry -> ProvenanceEntry (confidenceは落とす)
  const provenance = bridgeResult.provenance.map((p) => ({
    field: p.field,
    source: p.source,
    sourceLabel: p.sourceLabel,
    reason: p.reason,
    value: p.value,
    importedAt: p.importedAt || importedAt,
  }));

  return {
    planningSheetId,
    importedAt,
    importedBy,
    assessmentId: null, // Tokusei 単独取込の場合は null
    tokuseiResponseId,
    mode: 'with-tokusei', // Iceberg (iceberg) とは別モード
    affectedFields,
    provenance,
    summaryText,
  };
}

/**
 * 既に同じ TokuseiResponseId が取り込まれているか（二重記録防止用）を判定する。
 * 
 * @param existingRecords - シートに紐づく既存の監査レコード一覧
 * @param tokuseiResponseId - 取込対象のアンケート回答ID
 * @returns すでに取込済みであれば true
 */
export function hasAlreadyImportedTokusei(
  existingRecords: ImportAuditRecord[],
  tokuseiResponseId: string,
): boolean {
  return existingRecords.some(
    (record) => 
      record.mode === 'with-tokusei' && 
      record.tokuseiResponseId === tokuseiResponseId
  );
}
