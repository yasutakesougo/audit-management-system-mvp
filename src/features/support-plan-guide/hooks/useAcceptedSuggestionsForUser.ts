/**
 * useAcceptedSuggestionsForUser — 指定ユーザーの acceptedSuggestions を取得する hook
 *
 * Issue #10 Phase 2: SupportPlanGuide への接続
 *
 * Phase 2 ではスタブ実装（空配列を返す）。
 * Phase 3 で SharePoint から daily 記録の acceptedSuggestions を取得する実装に差し替える。
 *
 * この hook が items: [] を返す間、ISPCandidateImportSection は非表示になる。
 * → 接続パイプラインの正当性だけを先に確保する。
 *
 * @see src/features/daily/domain/suggestionAction.ts — SuggestionAction 型
 * @see src/features/support-plan-guide/components/tabs/ISPCandidateImportSection.tsx — 消費側
 */

import type { SuggestionAction } from '@/features/daily/domain/suggestionAction';

// ─── 型定義 ──────────────────────────────────────────────

/** データソースの種別（将来拡張用） */
export type SuggestionDataSource = 'stub' | 'sharepoint' | 'local';

/** hook の戻り値型 — Phase 3 で SP 連携に差し替えても崩れない契約 */
export type UseAcceptedSuggestionsReturn = {
  /** 取得された acceptedSuggestions（accept のみ） */
  items: SuggestionAction[];
  /** 取得中フラグ */
  isLoading: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** データソース種別 */
  source: SuggestionDataSource;
};

// ─── Hook ────────────────────────────────────────────────

/**
 * 指定ユーザーの acceptedSuggestions を取得する。
 *
 * Phase 2: スタブ実装（空配列を返す）
 * Phase 3: SharePoint から daily 記録の acceptedSuggestions を取得
 *
 * @param _userId - 対象利用者の ID（Phase 2 では未使用）
 */
export function useAcceptedSuggestionsForUser(
  _userId: string,
): UseAcceptedSuggestionsReturn {
  // ────────────────────────────────────────
  // Phase 3 で以下のような実装に差し替える:
  //
  // const [items, setItems] = useState<SuggestionAction[]>([]);
  // const [isLoading, setIsLoading] = useState(true);
  // const [error, setError] = useState<string | null>(null);
  //
  // useEffect(() => {
  //   const fetch = async () => {
  //     const records = await dailyRepo.listByUser(userId, dateRange);
  //     const accepted = records
  //       .flatMap(r => r.acceptedSuggestions ?? [])
  //       .filter(a => a.action === 'accept');
  //     setItems(accepted);
  //   };
  //   fetch();
  // }, [userId]);
  //
  // return { items, isLoading, error, source: 'sharepoint' };
  // ────────────────────────────────────────

  return {
    items: [],
    isLoading: false,
    error: null,
    source: 'stub',
  };
}
