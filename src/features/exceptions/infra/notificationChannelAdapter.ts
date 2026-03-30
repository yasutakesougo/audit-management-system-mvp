/**
 * @fileoverview 通知チャネル配送 Adapter (Mock / Strategy)
 */
import type { 
  NotificationDeliveryResult, 
  TeamsEscalationPayload, 
  InAppEscalationPayload 
} from '../domain/notificationTypes';

/**
 * 送信ポート (送信実体の抽象化)
 */
export interface NotificationPort {
  sendTeamsAlert(payload: TeamsEscalationPayload): Promise<NotificationDeliveryResult>;
  sendInAppAlert(payload: InAppEscalationPayload): Promise<NotificationDeliveryResult>;
}

/**
 * 開発/デモ用のインフラ Adapter
 */
export const mockNotificationAdapter: NotificationPort = {
  async sendTeamsAlert(payload): Promise<NotificationDeliveryResult> {
    // 実際の実装では fetch('https://outlook.office.com/webhook/...') を行う
    // eslint-disable-next-line no-console
    console.log('🚀 [TEAMS SEND] Sending Payload:', payload);
    await new Promise(r => setTimeout(r, 500)); // シミュレーション
    return {
      channel: 'teams',
      success: true,
      timestamp: new Date().toISOString(),
      traceId: `t-${Math.random().toString(36).slice(2, 9)}`
    };
  },

  async sendInAppAlert(payload): Promise<NotificationDeliveryResult> {
    // 実際の実装では WebSocket や Redux Dispatch を行う
    // eslint-disable-next-line no-console
    console.log('🔔 [IN-APP ALERT] Notification Dispatch:', payload);
    await new Promise(r => setTimeout(r, 200)); // シミュレーション
    return {
      channel: 'in-app',
      success: true,
      timestamp: new Date().toISOString(),
      traceId: `ia-${Math.random().toString(36).slice(2, 9)}`
    };
  }
};
