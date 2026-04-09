/**
 * @fileoverview Escalation 判定の Pure Function 群
 */
import { ExceptionItem } from './exceptionLogic';
import type { 
  EscalationDecision, 
  EscalationLevel, 
  EscalationRole, 
  NotificationSuppressionState, 
  EscalationReason, 
  EscalationReasonCode 
} from './escalationTypes';

const REASONS: Record<EscalationReasonCode, EscalationReason> = {
  severity_critical: { code: 'severity_critical', label: '致命的例外', description: '支援の安全に直結する重大な不備です' },
  aging_threshold: { code: 'aging_threshold', label: '長時間放置', description: '検知から一定時間が経過しましたが解消されていません' },
  stale_high_risk: { code: 'stale_high_risk', label: '高リスク放置', description: 'リスク指摘事項が継続的に放置されています' },
  user_risk_cluster: { code: 'user_risk_cluster', label: '同一利用者への集中', description: '特定の利用者に複数の例外が発生しており、現場の負荷が高まっています' },
  safety_fast_lane: { code: 'safety_fast_lane', label: '安全管理優先', description: '安全管理責任者への即時報告が必要な案件です' },
  resolved_reopened: { code: 'resolved_reopened', label: '再発生', description: '一度解消されたはずの項目が再度検知されました' },
  repeated_warning: { code: 'repeated_warning', label: '警告の蓄積', description: '注意喚起が重ねて必要です' }
};

interface EvaluatorInput {
  item: ExceptionItem;
  suppression?: NotificationSuppressionState;
  now: Date;
  clusterCount?: number; // 同一利用者の例外数
}

/**
 * 個別例外に対するエスカレーション判定
 */
export function evaluateEscalation(input: EvaluatorInput): EscalationDecision {
  const { item, suppression, now, clusterCount = 1 } = input;
  const agingMinutes = calculateAging(item.updatedAt, now);
  
  const reasons: EscalationReason[] = [];
  let level: EscalationLevel = 'none';
  const targetRoles: Set<EscalationRole> = new Set();
  
  // 1. Critical Base
  if (item.severity === 'critical') {
    level = 'alert';
    reasons.push(REASONS.severity_critical);
    targetRoles.add('primary_staff');
    targetRoles.add('team_lead');
  }

  // 2. Aging Threshold (Critical -> 30m, High -> 2h, Medium -> 4h)
  if (item.severity === 'critical' && agingMinutes >= 30) {
    level = 'warning';
    reasons.push(REASONS.aging_threshold);
    targetRoles.add('service_manager');
    targetRoles.add('safety_manager');
  } else if (item.severity === 'high' && agingMinutes >= 120) {
    level = 'warning';
    reasons.push(REASONS.aging_threshold);
    targetRoles.add('team_lead');
    targetRoles.add('service_manager');
  }

  // 3. User Risk Clustering (3件以上で Level Up)
  if (clusterCount >= 3) {
    level = (level === 'none' || level === 'alert' || level === 'warning') ? 'warning' : level;
    reasons.push(REASONS.user_risk_cluster);
    targetRoles.add('service_manager');
    targetRoles.add('facility_admin');
  }

  // 4. Safety Fast Lane (特定の重要カテゴリ)
  if (item.category === 'risk-deviation' && item.severity === 'critical') {
    level = 'emergency';
    reasons.push(REASONS.safety_fast_lane);
    targetRoles.add('safety_manager');
    targetRoles.add('facility_admin');
  }

  // 5. Suppression Window Check (同一レベルなら 60分は静かにする)
  const isSuppressed = checkSuppression(suppression, level, now);

  return {
    level,
    targetRoles: Array.from(targetRoles),
    reasons,
    suggestedAction: item.actionLabel ? `${item.actionLabel}を行ってください。` : '至急現場の実施状況を確認し、是正を行ってください。',
    isSuppressed,
    needsImmediateAction: level === 'emergency' || level === 'warning'
  };
}

/**
 * 重複通知の判定 (抑制判定)
 */
function checkSuppression(
  suppression: NotificationSuppressionState | undefined, 
  currentLevel: EscalationLevel, 
  now: Date
): boolean {
  if (!suppression || currentLevel === 'none') return false;
  
  const isLevelUp = getLevelWeight(currentLevel) > getLevelWeight(suppression.lastEscalationLevel);
  if (isLevelUp) return false;

  const lastNotified = new Date(suppression.lastNotifiedAt);
  const diffMinutes = (now.getTime() - lastNotified.getTime()) / 60000;
  
  return diffMinutes < 60;
}

function calculateAging(updatedAt: string, now: Date): number {
  const updatedDate = new Date(updatedAt);
  return Math.max(0, (now.getTime() - updatedDate.getTime()) / 60000);
}

function getLevelWeight(level: EscalationLevel): number {
  const weights: Record<EscalationLevel, number> = { none: 0, alert: 1, warning: 2, emergency: 3 };
  return weights[level];
}
