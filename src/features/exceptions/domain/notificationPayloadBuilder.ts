/**
 * @fileoverview EscalationDecision から通知ペイロードを生成する Builder
 */
import { ExceptionItem } from './exceptionLogic';
import type { EscalationDecision, EscalationLevel } from './escalationTypes';
import type { 
  EscalationNotificationEnvelope, 
  TeamsEscalationPayload, 
  InAppEscalationPayload,
  NotificationChannel
} from './notificationTypes';

/**
 * 判定結果から通知封筒 (Envelope) を構築
 */
export function buildEscalationEnvelope(
  decision: EscalationDecision, 
  item: ExceptionItem
): EscalationNotificationEnvelope {
  const timestamp = new Date().toISOString();
  
  // レベルごとに送信チャネルを決定
  const channels: NotificationChannel[] = [];
  if (decision.level === 'emergency') {
    channels.push('teams', 'in-app', 'push');
  } else if (decision.level === 'warning') {
    channels.push('in-app');
  }

  return {
    id: `notif-${item.id}-${timestamp}`,
    exceptionId: item.id,
    level: decision.level,
    decision,
    item,
    timestamp,
    channels
  };
}

/**
 * Teams 向けペイロードへの変換 (Adaptive Cards 対応を想定)
 */
export function mapToTeamsPayload(envelope: EscalationNotificationEnvelope): TeamsEscalationPayload {
  const { item, decision } = envelope;
  
  const priorityMap: Record<EscalationLevel, 'High' | 'Normal' | 'Low'> = {
    emergency: 'High',
    warning: 'Normal',
    alert: 'Low',
    none: 'Low'
  };

  return {
    title: `【${decision.level.toUpperCase()}】支援不和の検知報告`,
    summary: `${item.targetUser} 様に関する重大な例外が検知されました。`,
    priority: priorityMap[decision.level],
    sections: [
      { label: '重要度', value: decision.level },
      { label: '検知理由', value: decision.reasons.map(r => r.label).join(' / ') },
      { label: '対象', value: item.targetUser || '施設横断' },
      { label: '指示', value: decision.suggestedAction }
    ],
    actions: [
      { label: 'Exception Center で詳細を確認', url: `/exceptions/details?id=${item.id}` },
      { label: '対象利用者の記録を確認', url: `/daily/activity?userId=${item.targetUserId}` }
    ]
  };
}

/**
 * アプリ内通知 (In-app Admin Alert) 向けペイロードへの変換
 */
export function mapToInAppPayload(envelope: EscalationNotificationEnvelope): InAppEscalationPayload {
  const { item, decision } = envelope;
  
  return {
    type: decision.level === 'emergency' ? 'urgency' : 'info',
    title: item.title,
    message: `${decision.reasons.map(r => r.label).join('/')}: ${item.description}`,
    link: `/exceptions/details?id=${item.id}`,
    linkText: '詳細確認',
    metadata: {
      exceptionId: item.id,
      level: decision.level,
      reasons: decision.reasons.map(r => r.code)
    }
  };
}
