/**
 * TabProps — タブコンポーネント共通Props型定義
 *
 * 全セクションタブで共通して必要なProps。
 * PreviewTab は独自のPropsを持つため別途定義。
 */
import type { SupportPlanBundle } from '@/domain/isp/schema';
import type { GoalItem } from '@/features/shared/goal/goalTypes';
import type { SupportPlanForm, SupportPlanStringFieldKey, UserOption } from '../../types';

/** 8つのセクションタブ(overview〜excellence) が共通で受け取る Props */
export type SectionTabProps = {
  /** 現在のフォームデータ */
  form: SupportPlanForm;
  /** 管理者かどうか（falseなら読み取り専用）— 後方互換用。新コードは planRole/can を使う */
  isAdmin: boolean;
  /** P4: 解決済みロール */
  planRole?: import('../../domain/planPermissions').PlanRole;
  /** P4: capability 判定ショートカット */
  can?: (cap: import('../../domain/planPermissions').PlanCapability) => boolean;
  /** フィールド値の変更ハンドラ */
  onFieldChange: (key: SupportPlanStringFieldKey, value: string) => void;
  /** クイックフレーズ追記ハンドラ */
  onAppendPhrase: (key: SupportPlanStringFieldKey, phrase: string) => void;
  /** 非管理者にトーストを出すガード関数 */
  guardAdmin: <T>(fn: (...args: unknown[]) => T) => (...args: unknown[]) => T | undefined;

  // ── Goal actions (Phase 3) ──
  /** GoalItem の部分更新 */
  onGoalChange?: (goalId: string, updates: Partial<GoalItem>) => void;
  /** 5 領域ドメインタグの ON/OFF 切り替え */
  onToggleDomain?: (goalId: string, domainId: string) => void;
  /** 新規目標の追加 */
  onAddGoal?: (type: GoalItem['type'], defaultLabel: string) => void;
  /** 目標の削除 */
  onDeleteGoal?: (goalId: string) => void;

  // ── Suggested Goals (P3-B) ──
  /** SupportPlanBundle（目標候補生成のデータソース） */
  bundle?: SupportPlanBundle | null;
  /** 目標候補を採用してフォームの goals に追加するハンドラ */
  onAcceptSuggestion?: (goal: GoalItem) => void;

  // ── User Link (利用者マスタ紐付け) ──
  /** 利用者マスタ選択肢（OverviewTab で使用） */
  userOptions?: UserOption[];
  /** 現在のドラフトに紐づいている利用者ID */
  linkedUserId?: number | string | null;
  /** 現在のドラフトに紐づいている利用者コード */
  linkedUserCode?: string | null;
  /** 利用者マスタから利用者を選択するハンドラ */
  onSelectUser?: (userId: string) => void;

  // ── Suggestion Decision Persistence (P3-D) ──
  /** SmartTab 用: 永続化済みの初期 decisions */
  smartInitialDecisions?: Record<string, import('../../hooks/useSuggestedGoals').SuggestedGoalDecision>;
  /** ExcellenceTab 用: 永続化済みの初期 memo actions */
  memoInitialActions?: Record<string, import('../../hooks/useSuggestionMemo').SuggestionMemoAction>;
  /** 判断変更時の永続化コールバック */
  onDecisionChange?: import('../../hooks/useSuggestedGoals').OnDecisionChange;
  /** undo 時の永続化コールバック */
  onDecisionUndo?: import('../../hooks/useSuggestedGoals').OnDecisionUndo;

  // ── Suggestion Decision Metrics (P3-E) ──
  /** 横断メトリクス（SmartTab / ExcellenceTab ヘッダーに表示） */
  suggestionMetrics?: import('../../domain/suggestionDecisionMetrics').SuggestionDecisionMetrics;

  // ── Suggestion Rule Metrics (P3-F) ──
  /** ルール別メトリクス算出のための生データ（ExcellenceTab で suggestions と突き合わせ） */
  suggestionDecisions?: import('../../types').SuggestionDecisionRecord[];
};
