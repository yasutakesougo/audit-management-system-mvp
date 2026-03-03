// ---------------------------------------------------------------------------
// useAuditEvidenceReport — 監査エビデンスレポートのデータ抽出・変換フック
// IBDストアからデータを読み出し、レポート構造に変換する
// ---------------------------------------------------------------------------
import { useCallback, useMemo } from 'react';

import type {
    AuditEvidenceReportData,
    ComplianceSummary,
    SPSHistoryRow,
    SupervisionLogRow,
} from '../ibdReportTypes';
import {
    getSPSForUser,
    getSupervisionLogsForUser,
} from '../ibdStore';
import type { PDCARecommendation } from '../ibdTypes';
import { PDCA_RECOMMENDATION_LABELS } from '../ibdTypes';

// ---------------------------------------------------------------------------
// ヘルパー
// ---------------------------------------------------------------------------

function daysBetween(dateA: string, dateB: string): number {
  const a = new Date(dateA);
  const b = new Date(dateB);
  const aUtc = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bUtc = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor(Math.abs(bUtc - aUtc) / (1000 * 60 * 60 * 24));
}

function truncate(text: string, maxLen = 100): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuditEvidenceReport(userId: number, userName: string) {
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  const prepareReportData = useCallback(
    (generatedBy: string): AuditEvidenceReportData => {
      const spsList = getSPSForUser(userId);
      const logs = getSupervisionLogsForUser(userId);

      // --- SPS確定履歴 ---
      const spsHistory: SPSHistoryRow[] = spsList.map((sps) => {
        const daysFromConfirmation = sps.confirmedAt
          ? daysBetween(sps.confirmedAt, today)
          : 0;
        return {
          spsId: sps.id,
          version: sps.version,
          createdAt: sps.createdAt,
          confirmedAt: sps.confirmedAt,
          confirmedBy: sps.confirmedBy != null ? `ID:${sps.confirmedBy}` : null,
          nextReviewDueDate: sps.nextReviewDueDate,
          daysFromConfirmation,
          isWithinCycle: daysFromConfirmation <= 90,
        };
      });

      // --- 観察ログ ---
      const supervisionLogs: SupervisionLogRow[] = logs.map((log) => ({
        logId: log.id,
        observedAt: log.observedAt,
        supervisorName: `ID:${log.supervisorId}`,
        adherenceToManual: log.adherenceToManual ?? null,
        pdcaRecommendation: log.pdcaRecommendation ?? null,
        discoveredConditionsCount: log.discoveredPositiveConditions?.length ?? 0,
        suggestedUpdatesCount: log.suggestedProcedureUpdates?.length ?? 0,
        notesSummary: truncate(log.notes),
      }));

      // --- 遵守状況サマリ ---
      const confirmedSPS = spsList.filter((s) => s.status === 'confirmed');
      const onTimeSPS = spsHistory.filter((h) => h.isWithinCycle);

      // 観察比率計算: ログ数 / 推定支援回数
      // 推定支援回数 = ログ数 × 2（2回に1回の観察義務）
      const totalObservationCount = logs.length;
      const estimatedTotalSupport = Math.max(totalObservationCount * 2, totalObservationCount);

      // PDCA推奨の内訳
      const pdcaBreakdown: Record<PDCARecommendation, number> = {
        continue: 0,
        adjust: 0,
        revise: 0,
        escalate: 0,
      };
      for (const log of logs) {
        if (log.pdcaRecommendation) {
          pdcaBreakdown[log.pdcaRecommendation]++;
        }
      }

      // 平均遵守度
      const adherenceValues = logs
        .map((l) => l.adherenceToManual)
        .filter((v): v is number => v != null);
      const averageAdherence =
        adherenceValues.length > 0
          ? Math.round(
              (adherenceValues.reduce((a, b) => a + b, 0) / adherenceValues.length) * 10
            ) / 10
          : null;

      const totalDiscoveredConditions = logs.reduce(
        (acc, l) => acc + (l.discoveredPositiveConditions?.length ?? 0),
        0
      );
      const totalSuggestedUpdates = logs.reduce(
        (acc, l) => acc + (l.suggestedProcedureUpdates?.length ?? 0),
        0
      );

      const complianceSummary: ComplianceSummary = {
        spsReviewCycleCount: confirmedSPS.length,
        spsReviewOnTimeCount: onTimeSPS.length,
        spsComplianceRate:
          confirmedSPS.length > 0
            ? Math.round((onTimeSPS.length / confirmedSPS.length) * 100)
            : 100,
        totalSupportCount: estimatedTotalSupport,
        totalObservationCount,
        observationRatio:
          estimatedTotalSupport > 0
            ? Math.round((totalObservationCount / estimatedTotalSupport) * 100)
            : 100,
        meetsObservationRequirement:
          estimatedTotalSupport === 0 ||
          totalObservationCount / estimatedTotalSupport >= 0.5,
        averageAdherence,
        pdcaBreakdown,
        totalDiscoveredConditions,
        totalSuggestedUpdates,
      };

      // 対象期間: 最古のSPS作成日 〜 today
      const allDates = [
        ...spsList.map((s) => s.createdAt),
        ...logs.map((l) => l.observedAt),
      ].filter(Boolean);
      const from = allDates.length > 0
        ? allDates.sort()[0]
        : today;

      return {
        userName,
        userId,
        reportPeriod: { from, to: today },
        generatedAt: new Date().toISOString(),
        generatedBy,
        spsHistory,
        supervisionLogs,
        complianceSummary,
      };
    },
    [userId, userName, today]
  );

  return { prepareReportData };
}

// Re-export labels for PDF usage
export { PDCA_RECOMMENDATION_LABELS };
