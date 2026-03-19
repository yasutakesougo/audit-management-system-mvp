/**
 * useExceptionDataSources — ExceptionCenterPage 用データ統合 hook
 *
 * Sprint-1 Phase B: 実データ接続
 *
 * 3つのデータソースを統合し、exceptionLogic の detect 関数に渡す形に変換:
 * 1. DailyRecord → 今日の記録状況 (未入力者の特定)
 * 2. Handoff → 重要申し送りの未対応分
 * 3. Users → 注意対象者 + ISP 有無
 *
 * @see features/daily/schema.ts — DailyRecordDomainSchema (userRows)
 * @see features/handoff/handoffTypes.ts — HandoffRecord (userCode, userDisplayName)
 * @see features/exceptions/domain/exceptionLogic.ts — detect 関数の入力型
 */
import { useEffect, useMemo, useState } from 'react';

import { useDailyRecordRepository } from '@/features/daily/repositoryFactory';
import type { DailyRecordItem } from '@/features/daily/domain/DailyRecordRepository';
import { useHandoffData } from '@/features/handoff/hooks/useHandoffData';
import type { HandoffRecord } from '@/features/handoff/handoffTypes';
import { useUsers } from '@/features/users/useUsers';
import type { DailyRecordSummary, HandoffSummaryItem, UserSummary } from '../domain/exceptionLogic';

// ── 型定義 ──

/** 画面判断の共通契約 — boolean 群ではなく 1 つの status で制御 */
export type DataSourceStatus = 'loading' | 'ready' | 'empty' | 'error';

export type ExceptionDataSources = {
  /** 今日の日付 (YYYY-MM-DD) */
  today: string;
  /** アクティブユーザーの一覧 (detectMissingRecords 用) */
  expectedUsers: Array<{ userId: string; userName: string }>;
  /** 今日の日次記録 (detectMissingRecords 用) */
  todayRecords: DailyRecordSummary[];
  /** 重要 × 未完了の申し送り (detectCriticalHandoffs 用) */
  criticalHandoffs: HandoffSummaryItem[];
  /** ユーザーサマリー (detectAttentionUsers 用) */
  userSummaries: UserSummary[];
  /** 4状態契約: loading → ready/empty/error */
  status: DataSourceStatus;
  /** エラー時のメッセージ */
  error: string | null;
};

// ── Hook ──

export function useExceptionDataSources(): ExceptionDataSources {
  const { data: users } = useUsers();
  const dailyRepo = useDailyRecordRepository();
  const { repo: handoffRepo } = useHandoffData();

  const [todayRecords, setTodayRecords] = useState<DailyRecordItem[]>([]);
  const [handoffRecords, setHandoffRecords] = useState<HandoffRecord[]>([]);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [handoffLoading, setHandoffLoading] = useState(true);
  const [dailyError, setDailyError] = useState<string | null>(null);
  const [handoffError, setHandoffError] = useState<string | null>(null);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

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
        if (!cancelled) { setTodayRecords([]); setDailyError(err instanceof Error ? err.message : '日次記録の取得に失敗'); }
      } finally {
        if (!cancelled) setDailyLoading(false);
      }
    }

    loadDailyRecords();
    return () => { cancelled = true; };
  }, [dailyRepo, today]);

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
    const criticalHandoffs: HandoffSummaryItem[] = handoffRecords
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
        isSupportProcedureTarget: u.IsSupportProcedureTarget ?? false,
        hasPlan: true, // TODO Phase 3: ISP Repository で実際に確認
      }));

    // 4状態契約
    const isLoading = dailyLoading || handoffLoading;
    const errorMsg = dailyError ?? handoffError;
    const status: DataSourceStatus = isLoading
      ? 'loading'
      : errorMsg
        ? 'error'
        : (dailyRecordSummaries.length === 0 && criticalHandoffs.length === 0)
          ? 'empty'
          : 'ready';

    return {
      today,
      expectedUsers,
      todayRecords: dailyRecordSummaries,
      criticalHandoffs,
      userSummaries,
      status,
      error: errorMsg,
    };
  }, [users, todayRecords, handoffRecords, today, dailyLoading, handoffLoading, dailyError, handoffError]);
}
