/**
 * useUserHubDataSources — UserDetailPage 用のデータ統合 hook
 *
 * Sprint-1 Phase B: 実データ接続
 *
 * userId 単位で今日の記録状況・申し送り・計画有無を集約し、
 * UserDetailPage の各セクションに供給する。
 *
 * @see features/daily/schema.ts — DailyRecordDomainSchema (userRows)
 * @see features/handoff/handoffTypes.ts — HandoffRecord
 */
import { useEffect, useMemo, useState } from 'react';

import { useDailyRecordRepository } from '@/features/daily/repositoryFactory';
import type { DailyRecordItem } from '@/features/daily/domain/DailyRecordRepository';
import { useHandoffData } from '@/features/handoff/hooks/useHandoffData';
import type { HandoffRecord } from '@/features/handoff/handoffTypes';

// ── 型定義 ──

export type UserHubDataSources = {
  /** 今日の記録が存在するか */
  hasRecordToday: boolean;
  /** 最新の日次記録（日付・承認状態のみ） */
  latestDailyRecord: { date: string; status: string } | null;
  /** 重要な未対応申し送りがあるか */
  hasCriticalHandoff: boolean;
  /** 重要申し送りの件数 */
  criticalHandoffCount: number;
  /** 申し送り情報（SummaryStats 用: total + criticalCount） */
  handoffInfo: { total: number; criticalCount: number } | null;
  /** 計画が存在するか (Phase 3: ISP接続) */
  hasPlan: boolean;
  /** 直近の日次記録で userId に対応する行があるもの (最大5件、buildRecentRecordPreview 用) */
  recentRecordsForUser: Array<{
    date: string;
    status: string;
    specialNotes?: string;
  }>;
  /** 直近の申し送り (最大5件) */
  recentHandoffs: Array<{
    id: string;
    message: string;
    severity: string;
    status: string;
    createdAt: string;
  }>;
  /** 読み込み中 */
  isLoading: boolean;
};

// ── Hook ──

export function useUserHubDataSources(userId: string | undefined): UserHubDataSources {
  const dailyRepo = useDailyRecordRepository();
  const { repo: handoffRepo } = useHandoffData();

  const [recentDailyRecords, setRecentDailyRecords] = useState<DailyRecordItem[]>([]);
  const [handoffRecords, setHandoffRecords] = useState<HandoffRecord[]>([]);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [handoffLoading, setHandoffLoading] = useState(true);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // 過去7日分の日次記録を取得
  useEffect(() => {
    if (!userId) {
      setRecentDailyRecords([]);
      setDailyLoading(false);
      return;
    }

    let cancelled = false;
    setDailyLoading(true);

    async function loadRecords() {
      try {
        const endDate = today;
        const d = new Date();
        d.setDate(d.getDate() - 7);
        const startDate = d.toISOString().split('T')[0];

        const records = await dailyRepo.list({
          range: { startDate, endDate },
        });
        if (!cancelled) setRecentDailyRecords(records);
      } catch (err) {
        console.warn('[useUserHubDataSources] DailyRecord load failed:', err);
        if (!cancelled) setRecentDailyRecords([]);
      } finally {
        if (!cancelled) setDailyLoading(false);
      }
    }

    loadRecords();
    return () => { cancelled = true; };
  }, [dailyRepo, userId, today]);

  // 申し送りを取得
  useEffect(() => {
    if (!userId) {
      setHandoffRecords([]);
      setHandoffLoading(false);
      return;
    }

    let cancelled = false;
    setHandoffLoading(true);

    async function loadHandoffs() {
      try {
        const records = await handoffRepo.getRecords('today', 'all');
        if (!cancelled) setHandoffRecords(records);
      } catch (err) {
        console.warn('[useUserHubDataSources] Handoff load failed:', err);
        if (!cancelled) setHandoffRecords([]);
      } finally {
        if (!cancelled) setHandoffLoading(false);
      }
    }

    loadHandoffs();
    return () => { cancelled = true; };
  }, [handoffRepo, userId]);

  return useMemo((): UserHubDataSources => {
    if (!userId) {
      return {
        hasRecordToday: false,
        latestDailyRecord: null,
        hasCriticalHandoff: false,
        criticalHandoffCount: 0,
        handoffInfo: null,
        hasPlan: false,
        recentRecordsForUser: [],
        recentHandoffs: [],
        isLoading: false,
      };
    }

    // userId に対応する記録行を持つ DailyRecord を抽出
    const recordsWithUserRow = recentDailyRecords
      .filter((record) =>
        (record.userRows ?? []).some((row) => String(row.userId) === userId),
      )
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

    // 今日の記録が存在するか
    const hasRecordToday = recordsWithUserRow.some((r) => r.date === today);

    // 最新の記録
    const latestRecord = recordsWithUserRow[0] ?? null;
    const latestDailyRecord = latestRecord
      ? {
          date: latestRecord.date ?? '',
          status: latestRecord.approvalStatus === 'approved' ? '承認済' : '未承認',
        }
      : null;

    // userId に対応する行の specialNotes を取得してプレビュー化
    const recentRecordsForUser = recordsWithUserRow.slice(0, 5).map((record) => {
      const userRow = (record.userRows ?? []).find((row) => String(row.userId) === userId);
      return {
        date: record.date ?? '',
        status: record.approvalStatus === 'approved' ? '完了' : '下書き',
        specialNotes: userRow?.specialNotes || undefined,
      };
    });

    // 重要な未対応申し送り
    const criticalHandoffs = handoffRecords.filter(
      (h) => h.severity === '重要' && h.status !== '完了' && h.status !== '確認済',
    );
    const criticalHandoffCount = criticalHandoffs.length;

    // 直近申し送り（全件から最大5件）
    const recentHandoffs = handoffRecords.slice(0, 5).map((h) => ({
      id: String(h.id),
      message: h.message ?? '',
      severity: h.severity ?? '',
      status: h.status ?? '',
      createdAt: h.createdAt ?? '',
    }));

    return {
      hasRecordToday,
      latestDailyRecord,
      hasCriticalHandoff: criticalHandoffCount > 0,
      criticalHandoffCount,
      handoffInfo: handoffRecords.length > 0
        ? { total: handoffRecords.length, criticalCount: criticalHandoffCount }
        : null,
      hasPlan: false, // TODO Phase 3: ISP Repository 接続
      recentRecordsForUser,
      recentHandoffs,
      isLoading: dailyLoading || handoffLoading,
    };
  }, [userId, recentDailyRecords, handoffRecords, today, dailyLoading, handoffLoading]);
}
