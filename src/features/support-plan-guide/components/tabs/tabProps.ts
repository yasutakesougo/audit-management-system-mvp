/**
 * TabProps — タブコンポーネント共通Props型定義
 *
 * 全セクションタブで共通して必要なProps。
 * PreviewTab は独自のPropsを持つため別途定義。
 */
import type { SupportPlanForm } from '../../types';

/** 8つのセクションタブ(overview〜excellence) が共通で受け取る Props */
export type SectionTabProps = {
  /** 現在のフォームデータ */
  form: SupportPlanForm;
  /** 管理者かどうか（falseなら読み取り専用） */
  isAdmin: boolean;
  /** フィールド値の変更ハンドラ */
  onFieldChange: (key: keyof SupportPlanForm, value: string) => void;
  /** クイックフレーズ追記ハンドラ */
  onAppendPhrase: (key: keyof SupportPlanForm, phrase: string) => void;
  /** 非管理者にトーストを出すガード関数 */
  guardAdmin: <T>(fn: (...args: unknown[]) => T) => (...args: unknown[]) => T | undefined;
};
