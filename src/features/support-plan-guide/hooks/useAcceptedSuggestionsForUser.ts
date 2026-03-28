/**
 * useAcceptedSuggestionsForUser — 指定ユーザーの acceptedSuggestions を取得する hook
 *
 * Issue #10 Phase 3: 実データ接続
 *
 * DailyRecordRepository.list() で直近30日の日次記録を取得し、
 * 対象ユーザーの accept 済み提案を集約して返す。
 *
 * 設計判断:
 * - 取得範囲: 直近30日（ISP 半期見直しに対して短いが、Phase 3 の安全な開始点。
 *   運用データが溜まった後に期間調整可能。定数 LOOKBACK_DAYS で一元管理）
 * - accepted のみ取得（dismiss は ISP 候補に不要）
 * - timestamp desc（新しい順）で返す — 最近の気づきが候補として使いやすい
 * - SP 変更ゼロ — UserRowsJSON に acceptedSuggestions は既に含まれている
 *
 * @see src/features/daily/domain/suggestionAction.ts — SuggestionAction 型
 * @see src/features/support-plan-guide/components/tabs/ISPCandidateImportSection.tsx — 消費側
 */

import { useState, useEffect, useRef } from 'react';
import { useDailyRecordRepository } from '@/features/daily/repositories/repositoryFactory';
import type { SuggestionAction } from '@/features/daily/domain/legacy/suggestionAction';
import { formatDateIso } from '@/lib/dateFormat';

// ─── 型定義 ──────────────────────────────────────────────

/** データソースの種別（将来拡張用） */
export type SuggestionDataSource = 'stub' | 'sharepoint' | 'local';

/** hook の戻り値型 — Phase 2 の契約をそのまま維持 */
export type UseAcceptedSuggestionsReturn = {
  /** 取得された acceptedSuggestions（accept のみ、新しい順） */
  items: SuggestionAction[];
  /** 取得中フラグ */
  isLoading: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** データソース種別 */
  source: SuggestionDataSource;
};

// ─── 定数 ────────────────────────────────────────────────

/**
 * acceptedSuggestions を遡る日数。
 *
 * 30日の根拠:
 * - ISP は半期見直しだが、直近の気づきが候補として最も有用
 * - daily list() の $top=100 と整合する現実的なデータ量
 * - 運用データ蓄積後に 14日 or 90日 への変更を検討可能
 */
export const LOOKBACK_DAYS = 30;

// ─── 内部ユーティリティ ──────────────────────────────────

/** 今日から N 日前の YYYY-MM-DD を返す */
export function computeDateRange(lookbackDays: number): {
  startDate: string;
  endDate: string;
} {
  const now = new Date();
  const endDate = formatDateIso(now);
  const start = new Date(now);
  start.setDate(start.getDate() - lookbackDays);
  const startDate = formatDateIso(start);
  return { startDate, endDate };
}



// ─── Hook ────────────────────────────────────────────────

/**
 * 指定ユーザーの acceptedSuggestions を取得する。
 *
 * Phase 3: DailyRecordRepository.list() から実データを取得。
 * - 直近 LOOKBACK_DAYS 日の記録を取得
 * - userId でフィルタ
 * - accept のみ抽出
 * - timestamp 降順（新しい順）で返す
 *
 * @param userId - 対象利用者の ID
 */
export function useAcceptedSuggestionsForUser(
  userId: string,
): UseAcceptedSuggestionsReturn {
  const repository = useDailyRecordRepository();
  const [items, setItems] = useState<SuggestionAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // repository の参照安定化（useMemo 済みだが念のため）
  const repositoryRef = useRef(repository);
  repositoryRef.current = repository;

  useEffect(() => {
    // userId が空なら即終了（ExcellenceTab で userId が無い場合のガード）
    if (!userId) {
      setItems([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();

    const fetchAccepted = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const range = computeDateRange(LOOKBACK_DAYS);

        const records = await repositoryRef.current.list({
          range,
          signal: controller.signal,
        });

        // 対象ユーザーの accept 済み提案を集約
        // NOTE: Zod スキーマでは category を z.string() でパースするため、
        // TypeScript 上は string 型になるが、実行時の値は SuggestionCategory として正しい。
        // SuggestionAction[] へのキャストは安全。
        const accepted = records
          .flatMap(r => r.userRows)
          .filter(row => String(row.userId) === String(userId))
          .flatMap(row => row.acceptedSuggestions ?? [])
          .filter(a => a.action === 'accept')
          // 新しい順（timestamp 降順）
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp)) as SuggestionAction[];

        if (!controller.signal.aborted) {
          setItems(accepted);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : '取得に失敗しました');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchAccepted();
    return () => controller.abort();
  }, [userId]);

  return { items, isLoading, error, source: 'sharepoint' };
}
