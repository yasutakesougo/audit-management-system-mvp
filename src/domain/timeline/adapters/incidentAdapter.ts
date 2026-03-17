/**
 * incidentAdapter — HighRiskIncident → TimelineEvent 変換
 *
 * インシデントドメインの重大事例レコードを
 * 統一タイムラインイベントに変換する純粋関数。
 *
 * 変換ルール:
 *   - occurredAt: そのまま（ISO 8601）
 *   - severity: '低' → info, '中' → warning, '高'/'重大インシデント' → critical
 */

import type { HighRiskIncident, RiskSeverity } from '@/domain/support/highRiskIncident';
import type { TimelineEvent, TimelineSeverity } from '../types';

/** Incident severity → 統一 severity マッピング */
const SEVERITY_MAP: Record<RiskSeverity, TimelineSeverity> = {
  '低': 'info',
  '中': 'warning',
  '高': 'critical',
  '重大インシデント': 'critical',
};

/**
 * HighRiskIncident を TimelineEvent に変換する。
 *
 * @param incident - インシデントレコード
 * @returns 統一タイムラインイベント
 */
export function incidentToTimelineEvent(incident: HighRiskIncident): TimelineEvent {
  return {
    id: `incident-${incident.id}`,
    source: 'incident',
    userId: incident.userId,
    occurredAt: incident.occurredAt,
    title: `インシデント (${incident.severity})`,
    description: incident.description,
    severity: SEVERITY_MAP[incident.severity] ?? 'warning',
    sourceRef: { source: 'incident', incidentId: incident.id },
    meta: { severity: incident.severity },
  };
}
