/**
 * useSupportPlanBundle — 本番 Repository から SupportPlanBundle を取得する hook
 *
 * SupportPlanGuidePage 上で制度サマリー帯に表示するデータを
 * ISP / PlanningSheet / ProcedureRecord の各 Repository から取得する。
 *
 * Repository 未接続（デモモード / SP未初期化）の場合は null を返し、
 * useRegulatorySummary のフォールバック（SupportPlanDraft ベース）が使われる。
 *
 * @see src/domain/isp/port.ts — Repository Port 定義
 * @see src/features/support-plan-guide/hooks/useRegulatorySummary.ts
 */
import { useEffect, useMemo, useState } from 'react';
import type { SupportPlanBundle, IndividualSupportPlan, PlanningSheetListItem, ProcedureRecordListItem } from '@/domain/isp/schema';
import type { IspRepository, PlanningSheetRepository, ProcedureRecordRepository } from '@/domain/isp/port';

// ─────────────────────────────────────────────
// 型
// ─────────────────────────────────────────────

export type UseSupportPlanBundleReturn = {
  /** Bundle データ（取得完了時）。未取得・エラー時は null */
  bundle: SupportPlanBundle | null;
  /** 取得中フラグ */
  isLoading: boolean;
  /** エラーメッセージ */
  error: string | null;
};

export type SupportPlanBundleRepositories = {
  ispRepo: IspRepository;
  planningSheetRepo: PlanningSheetRepository;
  procedureRecordRepo: ProcedureRecordRepository;
};

// ─────────────────────────────────────────────
// 集計ヘルパー
// ─────────────────────────────────────────────

/**
 * シート一覧から直近モニタリング情報を導出する。
 * 最新の lastMonitoringAt を持つシートの情報を使う。
 */
export function deriveLatestMonitoring(
  sheets: PlanningSheetListItem[],
): SupportPlanBundle['latestMonitoring'] {
  let latestDate: string | null = null;

  for (const sheet of sheets) {
    // PlanningSheetListItem に lastMonitoringAt がある場合
    const sheetAny = sheet as Record<string, unknown>;
    const monDate = (sheetAny['lastMonitoringAt'] ?? sheetAny['nextReviewAt']) as string | null;
    if (monDate && (!latestDate || monDate > latestDate)) {
      latestDate = monDate;
    }
  }

  if (!latestDate) return null;

  // 180日以上前なら planChangeRequired を true に
  const daysSince = Math.floor(
    (Date.now() - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24),
  );

  return {
    date: latestDate,
    planChangeRequired: daysSince >= 180,
  };
}

/**
 * 記録一覧を planningSheetId ごとに件数を集計する。
 * icebergCountBySheet の代替として使用。
 */
export function countRecordsBySheet(
  records: ProcedureRecordListItem[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const rec of records) {
    const sheetId = (rec as Record<string, unknown>)['planningSheetId'] as string | undefined;
    if (sheetId) {
      counts[sheetId] = (counts[sheetId] ?? 0) + 1;
    }
  }
  return counts;
}

// ─────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────

/**
 * 本番 Repository から SupportPlanBundle を組み立てる hook。
 *
 * @param userId - 対象利用者の ID。null の場合は取得しない。
 * @param repos - Repository インスタンス群。null の場合はスキップ。
 */
export function useSupportPlanBundle(
  userId: string | null,
  repos: SupportPlanBundleRepositories | null,
): UseSupportPlanBundleReturn {
  const [isp, setIsp] = useState<IndividualSupportPlan | null>(null);
  const [sheets, setSheets] = useState<PlanningSheetListItem[]>([]);
  const [records, setRecords] = useState<ProcedureRecordListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !repos) {
      setIsp(null);
      setSheets([]);
      setRecords([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        // 並行取得: ISP + シート一覧
        const [ispResult, sheetsResult] = await Promise.all([
          repos.ispRepo.getCurrentByUser(userId),
          repos.planningSheetRepo.listCurrentByUser(userId),
        ]);

        if (cancelled) return;

        setIsp(ispResult);
        setSheets(sheetsResult);

        // シートごとの記録を並行取得
        if (sheetsResult.length > 0) {
          const recordResults = await Promise.all(
            sheetsResult.map((sheet) =>
              repos.procedureRecordRepo.listByPlanningSheet(sheet.id),
            ),
          );

          if (cancelled) return;
          setRecords(recordResults.flat());
        } else {
          setRecords([]);
        }
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        console.warn('[useSupportPlanBundle] Repository fetch failed:', msg);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, repos]);

  const bundle = useMemo<SupportPlanBundle | null>(() => {
    if (!isp) return null;

    return {
      isp,
      planningSheets: [], // Full sheets need getById; listItems returns ListItem
      recentProcedureRecords: [], // ListItem → Record 変換は将来対応
      icebergCountBySheet: countRecordsBySheet(records),
      latestMonitoring: deriveLatestMonitoring(sheets),
    };
  }, [isp, sheets, records]);

  return { bundle, isLoading, error };
}
