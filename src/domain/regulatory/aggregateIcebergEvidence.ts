/**
 * aggregateIcebergEvidence — Iceberg PDCA アイテムを planningSheetId 軸で集計
 *
 * IcebergPdcaItem[] → IcebergEvidenceBySheet 変換を行う純粋関数。
 * RegulatoryDashboard の evidence summary を実データ駆動にするための
 * ブリッジレイヤー。
 *
 * planningSheetId を持たないアイテムは集計対象外（旧データ互換）。
 */
import type { IcebergEvidenceBySheet } from './findingEvidenceSummary';

// ── 入力の最小インタフェース（疎結合） ──

/** 集計に必要な最小フィールドのみ */
export interface IcebergPdcaSummarySource {
  planningSheetId?: string;
  updatedAt: string;
}

// ── 集計関数 ──

/**
 * Iceberg PDCA アイテム群を planningSheetId 軸で集計し、
 * IcebergEvidenceBySheet 形式に変換する。
 *
 * @param items - IcebergPdcaItem[] (または最小インタフェースを満たすもの)
 * @returns planningSheetId → { sessionCount, latestAnalysisDate }
 */
export function aggregateIcebergEvidence(
  items: IcebergPdcaSummarySource[],
): IcebergEvidenceBySheet {
  const sessionCount: Record<string, number> = {};
  const latestAnalysisDate: Record<string, string> = {};

  for (const item of items) {
    const sheetId = item.planningSheetId;
    if (!sheetId) continue;

    // セッション数カウント
    sessionCount[sheetId] = (sessionCount[sheetId] ?? 0) + 1;

    // 直近分析日（date 部分のみ比較）
    const itemDate = item.updatedAt.split('T')[0] ?? item.updatedAt;
    const current = latestAnalysisDate[sheetId];
    if (!current || itemDate > current) {
      latestAnalysisDate[sheetId] = itemDate;
    }
  }

  return { sessionCount, latestAnalysisDate };
}
