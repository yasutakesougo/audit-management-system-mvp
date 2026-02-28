/**
 * Cross-Module Integration - Daily User Snapshot
 * 利用者×日付をキーとした各モジュール情報の統合型定義
 */

// ========================================
// Core Types
// ========================================

/**
 * 通所状況（Attendance Module）
 */
export type AttendanceStatus = '未確認' | '通所中' | '退所済' | '当日欠席' | '遅刻' | '早退';

/**
 * 活動記録状況（Activity Module）
 */
export type ActivityStatus = '未作成' | '作成中' | '完了';

/**
 * IRC（統合リソースカレンダー）関連状況
 */
export type IrcStatus = '未定' | '予定あり' | '実行中' | '完了';

/**
 * 日次利用者スナップショット
 * 利用者1名の1日分のすべてのモジュール情報を統合
 */
export interface DailyUserSnapshot {
  // ========================================
  // Core Identifiers
  // ========================================
  /** 利用者ID */
  userId: string;
  /** 利用者名 */
  userName: string;
  /** 対象日付 (ISO形式: YYYY-MM-DD) */
  date: string;

  // ========================================
  // Attendance Module Data
  // ========================================
  /** 通所状況 */
  attendanceStatus?: AttendanceStatus;
  /** 提供時間（分） */
  providedMinutes?: number;
  /** 算定基準時間（分） */
  standardMinutes?: number;
  /** 乖離があるかどうか（提供時間 < 算定基準の80%） */
  hasServiceDiscrepancy?: boolean;
  /** 早退フラグ */
  isEarlyLeave?: boolean;

  // ========================================
  // Activity Module Data
  // ========================================
  /** 支援記録（ケース記録）記録状況 */
  activityStatus?: ActivityStatus;
  /** 問題行動記録の有無 */
  hasProblemBehavior?: boolean;
  /** 発作記録の有無 */
  hasSeizureRecord?: boolean;
  /** 食事摂取量 */
  mealAmount?: '完食' | '多め' | '半分' | '少なめ' | 'なし';

  // ========================================
  // IRC Module Data (Future Extension)
  // ========================================
  /** IRC（統合リソースカレンダー）状況 */
  ircStatus?: IrcStatus;
  /** 個別支援予定の有無 */
  hasIndividualSupport?: boolean;
  /** リハビリ予定の有無 */
  hasRehabilitation?: boolean;

  // ========================================
  // Cross-Module Analysis
  // ========================================
  /** モジュール間整合性チェック結果 */
  crossModuleIssues?: CrossModuleIssue[];
  /** サービス提供実績サマリ */
  serviceProvision?: ServiceProvisionSummary;
  /** 最終更新日時 */
  lastUpdated?: string;
}

/**
 * モジュール間不整合検出結果
 */
export interface CrossModuleIssue {
  /** 不整合ID */
  id: string;
  /** 不整合の種別 */
  type: 'attendance_activity_mismatch' | 'activity_irc_conflict' | 'data_missing' | 'attendance_provision_mismatch';
  /** 重要度 */
  severity: 'error' | 'warning' | 'info';
  /** 不整合の説明 */
  message: string;
  /** 関連するモジュール */
  involvedModules: ('attendance' | 'activity' | 'irc' | 'provision')[];
  /** 修正提案（オプション） */
  suggestedAction?: string;
}

// ========================================
// Utility Types
// ========================================

/**
 * DailyUserSnapshotの作成用入力データ
 */
export interface DailyUserSnapshotInput {
  userId: string;
  userName: string;
  date: string;
  attendanceData?: {
    status: AttendanceStatus;
    providedMinutes?: number;
    standardMinutes?: number;
    isEarlyLeave?: boolean;
  };
  activityData?: {
    status: ActivityStatus;
    hasProblemBehavior?: boolean;
    hasSeizureRecord?: boolean;
    mealAmount?: '完食' | '多め' | '半分' | '少なめ' | 'なし';
  };
  ircData?: {
    status: IrcStatus;
    hasIndividualSupport?: boolean;
    hasRehabilitation?: boolean;
  };
  /** サービス提供実績データ */
  serviceProvisionData?: ServiceProvisionSummary;
}

/**
 * 日付範囲での複数ユーザーのスナップショット
 */
export interface DailySnapshotCollection {
  /** 対象日付 */
  date: string;
  /** ユーザースナップショットのマップ（userId -> snapshot） */
  snapshots: Record<string, DailyUserSnapshot>;
  /** 生成日時 */
  generatedAt: string;
  /** 集計サマリー */
  summary: {
    totalUsers: number;
    attendanceComplete: number;
    activityComplete: number;
    crossModuleIssues: number;
  };
}
// ========================================
// Service Provision Snapshot Data
// ========================================

/**
 * サービス提供実績の要約データ
 */
export type ServiceProvisionSummary = {
  hasRecord: false;
} | {
  hasRecord: true;
  status: string;
  startHHMM: number | null;
  endHHMM: number | null;
  additions: {
    transport: boolean;
    meal: boolean;
    bath: boolean;
    extended: boolean;
    absentSupport: boolean;
  };
  notePreview?: string;
};
