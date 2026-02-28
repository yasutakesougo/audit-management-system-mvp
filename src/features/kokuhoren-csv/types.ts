/**
 * 国保連CSV — 列定義型
 *
 * 列ごとに kind（string/number）を持ち、
 * serialize時に引用符を物理的に制御する。
 */

/** 列の値種別 */
export type ColumnKind = 'string' | 'number';

/** CSV列定義 */
export interface CsvColumnDef {
  /** 列キー（generate71の出力オブジェクトのキーに対応） */
  key: string;
  /** ヘッダー名（デバッグ用、実CSVにはヘッダーなし） */
  label: string;
  /** 値の種別 — string→引用符あり、number→引用符なし */
  kind: ColumnKind;
}

/** 様式71の1行分の値 */
export type CsvRowValues = Record<string, string | number | null | undefined>;

/** generate71 の入力 — validateMonthly と同じ型を再利用 */
export type { MonthlyProvisionInput as CsvGenerateInput } from '@/features/kokuhoren-validation/types';
