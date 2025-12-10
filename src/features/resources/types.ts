/**
 * 統合リソースカレンダー用の型定義
 * Plan（計画）とActual（実績）を統合したイベント管理
 */

/**
 * Plan vs Actual ステータス
 */
export type PvsAStatus =
  | 'waiting'      // 実績なし - 予定のみ
  | 'in-progress'  // 開始済み・未終了 - 実行中
  | 'completed'    // 完了・差分±5分以内 - 正常完了
  | 'delayed'      // 完了・差分+5分超過 - 遅延完了
  | 'cancelled';   // キャンセル - 中止

/**
 * Plan種別
 */
export type PlanType =
  | 'visit'   // 利用者宅訪問
  | 'center'  // デイサービス・施設内
  | 'travel'  // 移動・送迎
  | 'break'   // 休憩
  | 'admin';  // 事務作業

/**
 * 統合リソースイベント
 * FullCalendar の EventInput と互換性を保ちつつ
 * Plan + Actual 情報を extendedProps で拡張
 */
export interface UnifiedResourceEvent {
  // FullCalendar 基本プロパティ
  id: string;
  resourceId: string;
  title: string;
  start: string; // ISO文字列 (計画開始時刻)
  end: string;   // ISO文字列 (計画終了時刻)

  // UI制御
  className?: string | string[];
  editable?: boolean;

  // 拡張プロパティ（Plan + Actual統合）
  extendedProps: {
    // === Plan情報 ===
    planId: string;
    planType?: PlanType;
    planDescription?: string;
    userId?: number;        // 利用者ID
    serviceType?: string;   // サービス種別

    // === Actual情報 ===
    recordId?: string;           // 実績記録ID
    actualStart?: string | null; // 実績開始時刻 (ISO)
    actualEnd?: string | null;   // 実績終了時刻 (ISO)
    status?: PvsAStatus;         // 現在のステータス
    percentComplete?: number;    // 進捗率 (0-100)
    notes?: string;              // 実績メモ・備考

    // === 計算済み情報 ===
    diffMinutes?: number | null; // 計画との差分 (分単位)
    startDelayMinutes?: number;  // 開始遅延 (分単位)
    endDelayMinutes?: number;    // 終了遅延 (分単位)
  };
}

/**
 * 実績更新イベント (リアルタイム通知用)
 */
export interface ActualUpdateEvent {
  planId: string;
  recordId?: string;
  actualStart?: string | null;
  actualEnd?: string | null;
  status: PvsAStatus;
  percentComplete?: number;
  notes?: string;
  diffMinutes?: number;
}

/**
 * リソース情報
 */
export interface ResourceInfo {
  id: string;
  title: string;
  type: 'staff' | 'vehicle';

  // スタッフ固有
  employmentType?: 'regular' | 'contract' | 'part-time';
  skills?: string[];
  maxHoursPerDay?: number;

  // 車両固有
  capacity?: number;
  isWheelchairAccessible?: boolean;
  equipment?: string[];
}

/**
 * 警告情報
 */
export interface ResourceWarning {
  resourceId: string;
  type: 'overtime' | 'consecutive-days' | 'skill-mismatch' | 'capacity-exceeded';
  severity: 'info' | 'warning' | 'error';
  message: string;
  date: string; // ISO文字列
}
