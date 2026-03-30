/**
 * @fileoverview 通知監査ログを生成するための Logger サービス (Domain Service)
 */
import type { 
  NotificationAuditLog
} from './notificationAuditTypes';
import type { 
  EscalationNotificationEnvelope, 
  NotificationDeliveryResult 
} from './notificationTypes';

/**
 * 送信結果から監査ログオブジェクトを生成
 */
export function createAuditLogFromDelivery(
  envelope: EscalationNotificationEnvelope, 
  result: NotificationDeliveryResult
): NotificationAuditLog {
  const { item, decision } = envelope;
  
  return {
    id: `audit-${result.traceId}-${result.channel}`,
    traceId: result.traceId || 'no-trace',
    createdAt: result.timestamp,
    channel: result.channel,
    status: result.success ? 'sent' : 'failed',
    escalationLevel: envelope.level,
    targetRoles: decision.targetRoles,
    userId: item.targetUserId || 'facility',
    userName: item.targetUser || '施設横断',
    sourceExceptionId: envelope.exceptionId,
    sourceExceptionCategory: item.category,
    title: item.title,
    message: item.description,
    reasons: decision.reasons.map(r => r.code),
    payloadSnapshot: envelope, // 封筒をスナップショットとして保存
    errorMessage: result.error
  };
}

/**
 * 抑制 (Suppression) された際の記録用ログ
 */
export function createAuditLogFromSuppression(
  envelope: EscalationNotificationEnvelope
): NotificationAuditLog {
  const { item, decision } = envelope;
  
  return {
    id: `audit-suppressed-${item.id}-${new Date().getTime()}`,
    traceId: 'suppressed',
    createdAt: new Date().toISOString(),
    channel: 'in-app', // 代表チャネル
    status: 'suppressed',
    escalationLevel: envelope.level,
    targetRoles: decision.targetRoles,
    userId: item.targetUserId || 'facility',
    userName: item.targetUser || '施設横断',
    sourceExceptionId: envelope.exceptionId,
    sourceExceptionCategory: item.category,
    title: item.title,
    message: '[SUPPRESSED] 重複通知抑制中',
    reasons: decision.reasons.map(r => r.code),
    payloadSnapshot: envelope
  };
}
