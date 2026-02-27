/**
 * 国保連プリバリデーション — 型定義
 *
 * 返戻ゼロを目指す判定エンジンの基盤型。
 * 純粋関数で使えるように副作用なし。
 */

// ─── 判定レベル ─────────────────────────────────────────────

/** BLOCK = 出力不可、WARNING = 確認後出力可、INFO = 自動補正済み通知 */
export type ValidationLevel = 'BLOCK' | 'WARNING' | 'INFO';

// ─── 判定結果 ───────────────────────────────────────────────

export interface ValidationIssue {
  /** ルールID（例: KOKU-71-001） */
  ruleId: string;
  /** 判定レベル */
  level: ValidationLevel;
  /** 対象利用者コード */
  userCode: string;
  /** 対象日付（YYYY-MM-DD） */
  targetDate: string;
  /** 問題のあるフィールド名（任意） */
  targetField?: string;
  /** ルール違反の説明 */
  message: string;
  /** 自動補正候補の値（自動クリア等） */
  autoCorrectedValue?: unknown;
  /** 自動補正されたか */
  autoCorrected?: boolean;
}

export interface ValidationResult {
  /** 対象年月（YYYY-MM） */
  yearMonth: string;
  /** 全ユーザーの全日分のIssue一覧 */
  issues: ValidationIssue[];
  /** 集計 */
  summary: {
    blockCount: number;
    warningCount: number;
    infoCount: number;
    totalRecords: number;
    validRecords: number;
  };
  /** CSV出力可能か（blockCount === 0） */
  isValidForExport: boolean;
}

// ─── バリデーション入力 ─────────────────────────────────────

/** 利用者マスタの国保連必須情報（最小） */
export interface KokuhorenUserProfile {
  userCode: string;
  userName: string;
  /** 受給者証番号（10桁） */
  recipientCertNumber?: string | null;
  /** 契約支給量（月間上限日数、任意） */
  contractDaysPerMonth?: number | null;
}

/** 1日分の実績レコード（ServiceProvisionRecord の薄いラッパー） */
export interface DailyProvisionEntry {
  userCode: string;
  recordDateISO: string;
  status: '提供' | '欠席' | 'その他';
  startHHMM?: number | null;
  endHHMM?: number | null;
  hasTransport?: boolean;
  hasTransportPickup?: boolean;
  hasTransportDropoff?: boolean;
  hasMeal?: boolean;
  hasBath?: boolean;
  hasExtended?: boolean;
  hasAbsentSupport?: boolean;
}

/** バリデーション入力（月単位） */
export interface MonthlyProvisionInput {
  /** 対象年月（YYYY-MM） */
  yearMonth: string;
  /** 利用者プロファイル一覧 */
  users: KokuhorenUserProfile[];
  /** 実績レコード一覧（対象月分） */
  records: DailyProvisionEntry[];
}

// ─── 派生値（derive.ts で算出） ─────────────────────────────

/** 算定時間コード（生活介護 様式71） */
export type TimeCode =
  | '01' // 〜2h
  | '02' // 2h〜3h
  | '03' // 3h〜4h
  | '04' // 4h〜5h
  | '05' // 5h〜6h
  | '06' // 6h〜7h
  | '07' // 7h〜8h
  | '08' // 8h〜
  | null; // 算出不能

export interface DerivedProvisionEntry extends DailyProvisionEntry {
  /** 滞在時間（分） */
  durationMinutes: number | null;
  /** 算定時間コード */
  timeCode: TimeCode;
}
