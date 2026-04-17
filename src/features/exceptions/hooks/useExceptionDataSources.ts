/**
 * useExceptionDataSources — ExceptionCenterPage 用データ統合 hook
 *
 * Sprint-1 Phase B: 実データ接続
 *
 * 4つのデータソースを統合し、exceptionLogic の detect 関数に渡す形に変換:
 * 1. DailyRecord → 今日の記録状況 (未入力者の特定)
 * 2. Handoff → 重要申し送りの未対応分
 * 3. Users → 注意対象者 + ISP 有無
 * 4. SupportLogs → 支援手順の実施の未作成者
 *
 * @see features/daily/schema.ts — DailyRecordDomainSchema (userRows)
 * @see features/handoff/handoffTypes.ts — HandoffRecord (userCode, userDisplayName)
 * @see features/exceptions/domain/exceptionLogic.ts — detect 関数の入力型
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useDailyRecordRepository } from '@/features/daily/repositories/repositoryFactory';
import type { DailyRecordItem } from '@/features/daily/domain/legacy/DailyRecordRepository';
import { useHandoffData } from '@/features/handoff/hooks/useHandoffData';
import type { HandoffRecord } from '@/features/handoff/handoffTypes';
import { useUsersQuery } from '@/features/users/hooks/useUsersQuery';
import { useIspRepositories } from '@/features/support-plan-guide/hooks/useIspRepositories';
import { useDataProviderObservabilityStore } from '@/lib/data/dataProviderObservabilityStore';
import type { DailyRecordSummary, ExceptionItem, HandoffSummaryItem, UserSummary } from '../domain/exceptionLogic';
import { useDailyIntegrityExceptions } from '@/features/daily/hooks/useDailyIntegrityExceptions';

// ── 型定義 ──

/** 画面判断の共通契約 — boolean 群ではなく 1 つの status で制御 */
export type DataSourceStatus = 'loading' | 'ready' | 'empty' | 'error';

export type ExceptionDataSources = {
  /** 今日の日付 (YYYY-MM-DD) */
  today: string;
  /** アクティブユーザーの一覧 (detectMissingRecords 用) */
  expectedUsers: Array<{ userId: string; userName: string }>;
  /** 今日の日々の記録 (detectMissingRecords 用) */
  todayRecords: DailyRecordSummary[];
  /** 重要 × 未完了の申し送り (buildHandoffExceptions / detectCriticalHandoffs 用) */
  criticalHandoffs: HandoffSummaryItem[];
  /** ユーザーサマリー (detectAttentionUsers 用) */
  userSummaries: UserSummary[];
  /** 整合性異常 (scanIntegrity 用) */
  integrityExceptions: ExceptionItem[];
  /** 4状態契約: loading → ready/empty/error */
  status: DataSourceStatus;
  /** エラー時のメッセージ */
  error: string | null;
  /** Data OS の解決状況 (detectDataLayerExceptions 用) */
  dataOSResolutions: Record<string, {
    resourceName: string;
    status: 'resolved' | 'missing_optional' | 'missing_required' | 'fallback_triggered' | 'schema_mismatch' | 'schema_warning' | 'pending';
    resolvedTitle: string;
    error?: string;
  }>;
  /** 日々の記録の再取得を要求する（保存後の即時同期用） */
  refetchDailyRecords: () => void;
};

// ── Hook ──

export function useExceptionDataSources(): ExceptionDataSources {
  const { data: users } = useUsersQuery();
  const dailyRepo = useDailyRecordRepository();
  const { repo: handoffRepo } = useHandoffData();
  const { ispRepo } = useIspRepositories();
  const resolutions = useDataProviderObservabilityStore(s => s.resolutions);

  const [todayRecords, setTodayRecords] = useState<DailyRecordItem[]>([]);
  const [handoffRecords, setHandoffRecords] = useState<HandoffRecord[]>([]);
  const [currentPlanUserIds, setCurrentPlanUserIds] = useState<Set<string>>(new Set());

  const [dailyLoading, setDailyLoading] = useState(true);
  const [handoffLoading, setHandoffLoading] = useState(true);
  const [ispLoading, setIspLoading] = useState(true);

  const [dailyError, setDailyError] = useState<string | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);
  const [ispError, setIspError] = useState<string | null>(null);

  /** Increment to re-trigger the dailyRecord useEffect */
  const [dailyRefreshTrigger, setDailyRefreshTrigger] = useState(0);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // 整合性異常 (Hook violation 修正: useMemo の外に移動)
  const { items: integrityExceptions, isLoading: integrityLoading } = useDailyIntegrityExceptions(today);

  const refetchDailyRecords = useCallback(() => {
    setDailyRefreshTrigger((prev) => prev + 1);
  }, []);

  // DailyRecord 取得
  useEffect(() => {
    let cancelled = false;
    setDailyLoading(true);

    async function loadDailyRecords() {
      try {
        const records = await dailyRepo.list({
          range: { startDate: today, endDate: today },
        });
        if (!cancelled) { setTodayRecords(records); setDailyError(null); }
      } catch (err) {
        console.warn('[useExceptionDataSources] DailyRecord load failed:', err);
        if (!cancelled) { setTodayRecords([]); setDailyError(err instanceof Error ? err.message : '日々の記録の取得に失敗'); }
      } finally {
        if (!cancelled) setDailyLoading(false);
      }
    }

    loadDailyRecords();
    return () => { cancelled = true; };
  }, [dailyRepo, today, dailyRefreshTrigger]);

  // Handoff 取得
  useEffect(() => {
    let cancelled = false;
    setHandoffLoading(true);

    async function loadHandoffs() {
      try {
        const records = await handoffRepo.getRecords('today', 'all');
        if (!cancelled) { setHandoffRecords(records); setHandoffError(null); }
      } catch (err) {
        console.warn('[useExceptionDataSources] Handoff load failed:', err);
        if (!cancelled) { setHandoffRecords([]); setHandoffError(err instanceof Error ? err.message : '申し送りの取得に失敗'); }
      } finally {
        if (!cancelled) setHandoffLoading(false);
      }
    }

    loadHandoffs();
    return () => { cancelled = true; };
  }, [handoffRepo]);

  // 現行 ISP 取得
  useEffect(() => {
    let cancelled = false;
    setIspLoading(true);

    async function loadCurrentIsps() {
      try {
        const currentIsps = await ispRepo.listAllCurrent();
        if (!cancelled) {
          const userIds = new Set(currentIsps.map(isp => isp.userId));
          setCurrentPlanUserIds(userIds);
          setIspError(null);
        }
      } catch (err) {
        console.warn('[useExceptionDataSources] ISP load failed:', err);
        if (!cancelled) {
          setCurrentPlanUserIds(new Set());
          setIspError(err instanceof Error ? err.message : '個別支援計画の取得に失敗');
        }
      } finally {
        if (!cancelled) setIspLoading(false);
      }
    }

    loadCurrentIsps();
    return () => { cancelled = true; };
  }, [ispRepo]);

  // データ変換
  return useMemo(() => {
    // アクティブユーザー一覧
    const expectedUsers = (users ?? [])
      .filter((u) => u.IsActive !== false)
      .map((u) => ({
        userId: u.UserID ?? String(u.Id),
        userName: u.FullName ?? '',
      }));

    // DailyRecord → DailyRecordSummary に変換
    // DailyRecordDomain.userRows にユーザーごとの記録が格納されている
    const dailyRecordSummaries: DailyRecordSummary[] = todayRecords.flatMap((record) =>
      (record.userRows ?? []).map((row) => ({
        userId: String(row.userId ?? ''),
        userName: row.userName ?? '',
        date: record.date ?? today,
        status: 'completed',
      })),
    );

    // Handoff → 重要 × 未完了をフィルタして HandoffSummaryItem に変換
    const criticalHandoffsSummary: HandoffSummaryItem[] = handoffRecords
      .filter((h) => h.severity === '重要' && h.status !== '完了' && h.status !== '確認済')
      .map((h) => ({
        id: String(h.id),
        message: h.message ?? '',
        severity: h.severity ?? '',
        status: h.status ?? '',
        userName: h.userDisplayName,
        userId: h.userCode,
        createdAt: h.createdAt ?? new Date().toISOString(),
      }));

    // Users → UserSummary に変換
    const userSummaries: UserSummary[] = (users ?? [])
      .filter((u) => u.IsActive !== false)
      .map((u) => ({
        userId: u.UserID ?? String(u.Id),
        userName: u.FullName ?? '',
        isHighIntensity: u.IsHighIntensitySupportTarget ?? false,
        isSupportProcedureTarget: (u.IsSupportProcedureTarget ?? false) || (u.IsHighIntensitySupportTarget ?? false),
        isTransportTarget: !!(u.TransportToDays?.length || u.TransportFromDays?.length),
        hasPlan: ispError
          ? true // ISP取得失敗時は、誤検知で全員が attention-user になるのを防ぐため安全側（true）に倒す
          : currentPlanUserIds.has(u.UserID ?? String(u.Id)),
      }));

    // 4状態契約
    // ISPエラー時は安全側にフォールバックするため全体の error 画面にはしない
    const isLoading = dailyLoading || handoffLoading || ispLoading || integrityLoading;
    const isFatalError = dailyError ?? handoffError;
    const errorMsg = dailyError ?? handoffError ?? ispError;
    const status: DataSourceStatus = isLoading
      ? 'loading'
      : isFatalError
        ? 'error'
        : (dailyRecordSummaries.length === 0 && criticalHandoffsSummary.length === 0 && integrityExceptions.length === 0)
          ? 'empty'
          : 'ready';

    return {
      today,
      expectedUsers,
      todayRecords: dailyRecordSummaries,
      criticalHandoffs: criticalHandoffsSummary,
      userSummaries,
      integrityExceptions,
      dataOSResolutions: resolutions,
      status,
      error: errorMsg,
      refetchDailyRecords,
    };
  }, [
    users,
    todayRecords,
    handoffRecords,
    currentPlanUserIds,
    today,
    dailyLoading,
    handoffLoading,
    ispLoading,
    dailyError,
    handoffError,
    ispError,
    integrityExceptions,
    integrityLoading,
    resolutions,
    refetchDailyRecords,
  ]);
}
