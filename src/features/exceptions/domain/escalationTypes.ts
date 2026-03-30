/**
 * @fileoverview Escalation 契約の SSOT
 */
import type { ExceptionSeverity, ExceptionCategory } from './exceptionLogic';

/**
 * エスカレーションレベル
 * none: 通常監視
 * alert: 担当者への再通知
 * warning: リーダーへの報告が必要
 * emergency: 管理者・安全管理責任者への即時要請
 */
export type EscalationLevel = 'none' | 'alert' | 'warning' | 'emergency';

/**
 * 通知対象ロール
 */
export type EscalationRole = 
  | 'primary_staff' 
  | 'team_lead' 
  | 'service_manager' 
  | 'safety_manager' 
  | 'facility_admin';

/**
 * エスカレーション理由
 */
export type EscalationReasonCode = 
  | 'severity_critical'        // 重要度が致命的
  | 'aging_threshold'         // 解消までの時間が閾値を超過
  | 'stale_high_risk'         // 高リスク状態の放置
  | 'user_risk_cluster'       // 同一利用者に例外が集中
  | 'safety_fast_lane'        // 安全管理上の最優先事項
  | 'resolved_reopened'       // 解消後の再発生
  | 'repeated_warning';       // 警告の繰り返し

export interface EscalationReason {
  code: EscalationReasonCode;
  label: string;
  description: string;
}

/**
 * エスカレーション判定結果
 */
export interface EscalationDecision {
  level: EscalationLevel;
  targetRoles: EscalationRole[];
  reasons: EscalationReason[];
  suggestedAction: string;
  isSuppressed: boolean; // 抑制期間内か
  needsImmediateAction: boolean;
}

/**
 * エスカレーションポリシーの定義
 */
export interface EscalationPolicy {
  id: string;
  category?: ExceptionCategory;
  severityThreshold?: ExceptionSeverity;
  agingThresholdMinutes: number;
  targets: EscalationRole[];
}

/**
 * 通知抑制の状態（重複通知防止用）
 */
export interface NotificationSuppressionState {
  exceptionId: string;
  lastNotifiedAt: string; // ISO String
  lastEscalationLevel: EscalationLevel;
  notificationCount: number;
}
