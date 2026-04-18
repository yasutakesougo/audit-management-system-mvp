/**
 * Remediation Notifier — 運用品質・SLO の状態を通知するための抽象レイヤー
 */

import type { SLOCompliance } from './policy';
import type { RemediationKPIs } from './metrics';

/** 通知レベル */
export type NotificationLevel = 'INFO' | 'WARNING' | 'CRITICAL';

/** 通知メッセージ構造 */
export interface RemediationAlert {
  level: NotificationLevel;
  title: string;
  message: string;
  details?: string[];
  timestamp: string;
}

/**
 * SLO Compliance からアラートを生成する
 */
export function createAlertFromCompliance(
  compliance: SLOCompliance,
  metrics: RemediationKPIs
): RemediationAlert {
  const timestamp = new Date().toISOString();

  if (compliance.status === 'breached') {
    return {
      level: 'CRITICAL',
      title: '🚨 SLO SERVICE BREACH - 自動修復停止',
      message: `修復品質が目標値を下回ったため、安全装置（キルスイッチ）が作動しました。`,
      details: compliance.violations,
      timestamp
    };
  }

  if (compliance.status === 'warning') {
    return {
      level: 'WARNING',
      title: '⚠️ 運用品質低下アラート',
      message: `いくつかの指標が目標値を下回っていますが、運用は継続されています。`,
      details: compliance.violations,
      timestamp
    };
  }

  return {
    level: 'INFO',
    title: '✅ 運用品質正常 (Compliant)',
    message: `すべての SLO 目標値を達成しています。`,
    details: [
      `成功率: ${Math.round(metrics.successRate * 100)}%`,
      `MTTR: ${Math.floor((metrics.meanTimeToRemediateMs || 0) / 60000)}分`,
      `バックログ: ${metrics.backlogCount}件`
    ],
    timestamp
  };
}

/**
 * 通知の出力先（インターフェース）
 */
export interface AlertTransport {
  send(alert: RemediationAlert): Promise<void>;
}

/**
 * コンソールへの通知（Nightly Job 用）
 */
export class ConsoleAlertTransport implements AlertTransport {
  async send(alert: RemediationAlert): Promise<void> {
    const icon = alert.level === 'CRITICAL' ? '🔴' : alert.level === 'WARNING' ? '🟡' : '🟢';
    // eslint-disable-next-line no-console
    console.log(`\n[REMEDIATION ALERT] ${icon} ${alert.level}`);
    // eslint-disable-next-line no-console
    console.log(`Title: ${alert.title}`);
    // eslint-disable-next-line no-console
    console.log(`Message: ${alert.message}`);
    if (alert.details?.length) {
      // eslint-disable-next-line no-console
      console.log('Details:');
      // eslint-disable-next-line no-console
      alert.details.forEach(d => console.log(` - ${d}`));
    }
    // eslint-disable-next-line no-console
    console.log(`At: ${alert.timestamp}\n`);
  }
}

/**
 * Teams Webhook への通知（実運用チャネル用）
 */
export class TeamsAlertTransport implements AlertTransport {
  constructor(private webhookUrl: string) {}

  async send(alert: RemediationAlert): Promise<void> {
    const color = alert.level === 'CRITICAL' ? 'd13438' : alert.level === 'WARNING' ? 'fcf200' : '107c10';
    
    const payload = {
      "@type": "MessageCard",
      "@context": "http://schema.org/extensions",
      "themeColor": color,
      "summary": alert.title,
      "sections": [{
        "activityTitle": `**${alert.title}**`,
        "activitySubtitle": `Level: ${alert.level} | Time: ${alert.timestamp}`,
        "text": alert.message,
        "facts": (alert.details || []).map(d => ({
          "name": "Detail",
          "value": d
        }))
      }],
      "potentialAction": [{
        "@type": "OpenUri",
        "name": "管理ダッシュボードを開く",
        "targets": [{ "os": "default", "uri": "https://audit-management-system.pages.dev/admin/status" }]
      }]
    };

    try {
      // eslint-disable-next-line no-restricted-globals -- TeamsAlertTransport SSOT: Webhook 通信用の唯一の出口
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`Teams Webhook failed with status ${response.status}`);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('❌ Failed to send Teams alert:', err);
    }
  }
}
