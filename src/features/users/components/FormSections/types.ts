/**
 * FormSections - 共通型定義
 *
 * 各セクションコンポーネントが受け取る props の型をまとめる。
 */
import type { DayField, FormErrors, FormValues } from '../../useUserForm';

export type { DayField, FormErrors, FormValues };

/** 全セクション共通の props */
export type FormSectionProps = {
  values: FormValues;
  errors: FormErrors;
  setField: <K extends keyof FormValues>(key: K, value: FormValues[K]) => void;
  toggleDay: (day: string, field: DayField) => void;
};
