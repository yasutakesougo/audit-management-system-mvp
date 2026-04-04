import { globalDriftEventBus } from './onDriftEvent';
import { DriftActionEvent } from './driftEvents';
import { readEnv } from '@/lib/env';

/**
 * DriftNotificationHandler — ドリフトイベントを Teams Webhook 等へ通知する。
 * 
 * 下記ルールに基づいて通知をフィルタリングする:
 * - auto_heal_failed: 即通知 (error)
 * - essential_missing: 即通知 (error)
 * - auto_heal_succeeded: 通知 (info)
 * - その他: 通知せず (デバッグログのみ)
 */
export class DriftNotificationHandler {
  private static instance: DriftNotificationHandler | null = null;
  private webhookUrl: string | null = null;

  private constructor() {
    this.webhookUrl = readEnv('VITE_TEAMS_WEBHOOK_URL', undefined) || readEnv('VITE_SLACK_WEBHOOK_URL', undefined);
    
    if (this.webhookUrl) {
      globalDriftEventBus.subscribe((e) => this.handleEvent(e));
      console.log('[DriftNotificationHandler] Initialized with webhook URL.');
    } else {
      console.log('[DriftNotificationHandler] Webhook URL not configured. Notifications disabled.');
    }
  }

  public static init(): DriftNotificationHandler {
    if (!this.instance) {
      this.instance = new DriftNotificationHandler();
    }
    return this.instance;
  }

  private async handleEvent(event: DriftActionEvent): Promise<void> {
    const shouldNotify = 
      event.kind === 'auto_heal_failed' || 
      event.kind === 'essential_missing' || 
      event.kind === 'auto_heal_succeeded';

    if (!shouldNotify || !this.webhookUrl) return;

    await this.sendNotification(event);
  }

  private async sendNotification(event: DriftActionEvent): Promise<void> {
    try {
      const color = event.severity === 'error' ? 'FF0000' : 
                    event.severity === 'warn' ? 'FFA500' : '00FF00';
      
      const payload = {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": color,
        "summary": `SharePoint Drift Alert: ${event.kind}`,
        "sections": [{
          "activityTitle": `🚨 Drift Action: ${event.kind}`,
          "activitySubtitle": `Domain: ${event.domain} / List: ${event.listKey}`,
          "facts": [
            { "name": "Event Kind", "value": event.kind },
            { "name": "Severity", "value": event.severity },
            { "name": "Timestamp", "value": event.timestamp },
          ],
          "text": event.message
        }]
      };

      if (!this.webhookUrl) return;

      await globalThis.fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

    } catch (e) {
      console.error('[DriftNotificationHandler] Failed to send notification to webhook.', e);
    }
  }
}

/**
 * 通知ハンドラを初期化する。
 */
export function initDriftNotificationHandler() {
  return DriftNotificationHandler.init();
}
