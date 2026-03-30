/**
 * @fileoverview 通知チャネル統合のための型契約 (SSOT)
 */
import type { EscalationDecision, EscalationLevel } from './escalationTypes';
import type { ExceptionItem } from './exceptionLogic';

/**
 * 通知チャネルの種類
 */
export type NotificationChannel = 'in-app' | 'teams' | 'push' | 'email';

/**
 * 通知封筒 (Envelope)
 * 判定結果とメタデータを内包し、各チャネルへの分配準備を行う。
 */
export interface EscalationNotificationEnvelope {
  id: string; // 追跡用ID
  exceptionId: string;
  level: EscalationLevel;
  decision: EscalationDecision;
  item: ExceptionItem;
  timestamp: string;
  channels: NotificationChannel[];
}

/**
 * Teams 通知用ペイロード
 * Adaptive Cards 等への変換を想定した構造。
 */
export interface TeamsEscalationPayload {
  title: string;
  summary: string;
  priority: 'High' | 'Normal' | 'Low';
  sections: {
    label: string;
    value: string;
  }[];
  actions: {
    label: string;
    url: string;
  }[];
}

/**
 * アプリ内通知 (In-app Admin Alert) 用ペイロード
 */
export interface InAppEscalationPayload {
  type: 'urgency' | 'info';
  title: string;
  message: string;
  link?: string;
  linkText?: string;
  metadata: {
    exceptionId: string;
    level: EscalationLevel;
    reasons: string[];
  };
}

/**
 * Push 通知用ペイロード
 */
export interface PushEscalationPayload {
  title: string;
  body: string;
  data: {
    path: string;
    exceptionId: string;
  };
}

/**
 * 通知送信結果
 */
export interface NotificationDeliveryResult {
  channel: NotificationChannel;
  success: boolean;
  timestamp: string;
  error?: string;
  traceId?: string;
}
