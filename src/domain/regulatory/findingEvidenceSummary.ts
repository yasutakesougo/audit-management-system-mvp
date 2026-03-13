/**
 * findingEvidenceSummary — finding ごとの分析根拠サマリーを解決する
 *
 * RegulatoryDashboard の finding 行で「なぜこの課題か」
 * 「どの分析に基づくか」をインライン表示するための情報を生成する。
 *
 * 入力は planningSheetId を軸にした Iceberg 分析データ。
 * Repository から取得した集計済みデータを受け取り、
 * finding ごとの根拠サマリーを返す。
 */
import type { AuditFinding } from '@/domain/regulatory';

// ─────────────────────────────────────────────
// 型
// ─────────────────────────────────────────────

/** Iceberg 分析の集計情報（シート単位） */
export interface IcebergEvidenceBySheet {
  /** planningSheetId → 分析セッション数 */
  sessionCount: Record<string, number>;
  /** planningSheetId → 直近分析日 */
  latestAnalysisDate: Record<string, string>;
}

/** finding 1件の根拠サマリー */
export interface FindingEvidenceSummary {
  /** 関連する Iceberg 分析件数 */
  icebergCount: number;
  /** 直近の Iceberg 分析日 */
  latestIcebergDate: string | null;
  /** サマリー文（表示用） */
  displayText: string;
  /** 根拠の有無 */
  hasEvidence: boolean;
}

// ─────────────────────────────────────────────
// 解決関数
// ─────────────────────────────────────────────

/**
 * finding 1件に対して根拠サマリーを解決する。
 *
 * planningSheetId がある finding は、そのシートに紐づく
 * Iceberg 分析の件数と直近日を返す。
 * planningSheetId がない finding（例: planning_sheet_missing）は
 * 「根拠なし」を返す。
 */
export function resolveFindingEvidence(
  finding: AuditFinding,
  icebergData: IcebergEvidenceBySheet | null,
): FindingEvidenceSummary {
  const noEvidence: FindingEvidenceSummary = {
    icebergCount: 0,
    latestIcebergDate: null,
    displayText: '',
    hasEvidence: false,
  };

  if (!finding.planningSheetId || !icebergData) {
    return noEvidence;
  }

  const count = icebergData.sessionCount[finding.planningSheetId] ?? 0;
  const latestDate = icebergData.latestAnalysisDate[finding.planningSheetId] ?? null;

  if (count === 0) {
    return {
      icebergCount: 0,
      latestIcebergDate: null,
      displayText: '分析なし — Iceberg 分析の実施を推奨',
      hasEvidence: false,
    };
  }

  return {
    icebergCount: count,
    latestIcebergDate: latestDate,
    displayText: `根拠: Iceberg ${count}件${latestDate ? ` / 直近 ${latestDate}` : ''}`,
    hasEvidence: true,
  };
}

/**
 * finding 一覧の全体に対して根拠サマリーを一括解決する。
 * Map<findingId, FindingEvidenceSummary> を返す。
 */
export function resolveAllFindingEvidence(
  findings: AuditFinding[],
  icebergData: IcebergEvidenceBySheet | null,
): Map<string, FindingEvidenceSummary> {
  const result = new Map<string, FindingEvidenceSummary>();
  for (const finding of findings) {
    result.set(finding.id, resolveFindingEvidence(finding, icebergData));
  }
  return result;
}
