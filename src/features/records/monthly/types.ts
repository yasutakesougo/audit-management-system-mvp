// 月次記録システムの型定義
// 日次記録を月単位で集計し、KPI・完了率・進捗を管理

// 月を 01〜12 に固定（型安全性向上）
type Month = '01' | '02' | '03' | '04' | '05' | '06' | '07' | '08' | '09' | '10' | '11' | '12';
export type YearMonth = `${number}-${Month}`; // '2025-11'

// ISO日付文字列（YYYY-MM-DD）
export type IsoDate = `${number}-${Month}-${string}`;

// 月次サマリーの一意識別子（userId__yearMonth）
export type MonthlySummaryId = `${string}__${YearMonth}`;

export interface MonthlyRecordKey {
  userId: string;       // Users_Master.UserCode
  yearMonth: YearMonth; // 'YYYY-MM' (厳密型）
}

export interface MonthlyKpi {
  totalDays: number;        // 月内の暦日（営業日でも可: オプション切替）
  plannedRows: number;      // テンプレ行 × 稼働日数 （19行/日 × 稼働日）
  completedRows: number;    // 完了チェック true の件数
  inProgressRows: number;   // 入力済みだが未完了
  emptyRows: number;        // 未入力（生成時に invariant 保証: emptyRows = max(0, plannedRows - completedRows - inProgressRows)）
  specialNotes: number;     // 特記事項あり件数
  incidents: number;        // 事故/ヒヤリ等のタグ件数（拡張）
}

export interface MonthlySummary extends MonthlyRecordKey {
  displayName: string;
  lastUpdatedUtc: string;     // ISO timestamp
  kpi: MonthlyKpi;
  completionRate: number;     // 0..100 (%) - completedRows / plannedRows × 100
  firstEntryDate?: IsoDate;   // 月初の初回記録日（YYYY-MM-DD）
  lastEntryDate?: IsoDate;    // 月内の最終記録日（YYYY-MM-DD）
  carryOverNotes?: number;    // 翌月持ち越しメモ数（拡張）
}

// 日次記録からの集計用インターフェース
export interface DailyRecord {
  id: string;
  userId: string;
  userName: string;
  recordDate: IsoDate;      // ISO date string (YYYY-MM-DD)
  completed: boolean;
  hasSpecialNotes: boolean;
  hasIncidents: boolean;
  isEmpty: boolean;         // 全フィールドが空の場合
}

// 月次サマリー操作の結果
export interface MonthlyAggregationResult {
  summary: MonthlySummary;
  processedRecords: number;
  skippedRecords: number;
  errors: string[];
}

// 月次記録のフィルタリング条件
export interface MonthlyRecordFilter {
  yearMonth?: YearMonth;
  userId?: string;
  department?: string;
  minCompletionRate?: number;
  maxCompletionRate?: number;
}

// 月次記録の並び順
export type MonthlyRecordSortKey =
  | 'displayName'
  | 'yearMonth'
  | 'completionRate'
  | 'completedRows'
  | 'lastUpdatedUtc';

export interface MonthlyRecordSort {
  key: MonthlyRecordSortKey;
  direction: 'asc' | 'desc';
}