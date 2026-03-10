/**
 * TabProps — タブコンポーネント共通Props型定義
 *
 * 全セクションタブで共通して必要なProps。
 * PreviewTab は独自のPropsを持つため別途定義。
 */
import type { GoalItem } from '@/features/shared/goal/goalTypes';
import type { SupportPlanForm, SupportPlanStringFieldKey, UserOption } from '../../types';

/** 8つのセクションタブ(overview〜excellence) が共通で受け取る Props */
export type SectionTabProps = {
  /** 現在のフォームデータ */
  form: SupportPlanForm;
  /** 管理者かどうか（falseなら読み取り専用） */
  isAdmin: boolean;
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

  // ── User Link (利用者マスタ紐付け) ──
  /** 利用者マスタ選択肢（OverviewTab で使用） */
  userOptions?: UserOption[];
  /** 現在のドラフトに紐づいている利用者ID */
  linkedUserId?: number | string | null;
  /** 現在のドラフトに紐づいている利用者コード */
  linkedUserCode?: string | null;
  /** 利用者マスタから利用者を選択するハンドラ */
  onSelectUser?: (userId: string) => void;
};
