import type { SupportPlanTimelineSummary } from './timeline.types';

export type GuidanceSeverity = 'info' | 'warn' | 'critical' | 'success';

export type SupportPlanGuidanceItem = {
  id: string;
  type: 'stagnation' | 'safety' | 'velocity' | 'compliance';
  severity: GuidanceSeverity;
  title: string;
  message: string;
  actionLabel?: string;
  fieldKey?: string;
};

export type SupportPlanGuidance = {
  items: SupportPlanGuidanceItem[];
  overallStatus: GuidanceSeverity;
};

/**
 * Support Plan Guidance Engine (Deterministic Rules)
 * 
 * Provides automated observations based on the timeline summary.
 */
export function buildSupportPlanGuidance(
  summary: SupportPlanTimelineSummary
): SupportPlanGuidance {
  const items: SupportPlanGuidanceItem[] = [];

  // 1. Stagnation Check (90 days)
  if (summary.stagnantSince) {
    const stagnantDate = new Date(summary.stagnantSince);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - stagnantDate.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays >= 90 && summary.totalVersions > 1) {
      items.push({
        id: 'rule-stagnant-90',
        type: 'stagnation',
        severity: 'warn',
        title: '計画停滞の可能性',
        message: `直近 ${diffDays} 日間、目標の構造的変更が確認されていません。現在の支援内容が固定化されている可能性があります。`,
        actionLabel: '目標の再評価を行う',
      });
    }
  }

  // 2. Critical Safety Updates
  if (summary.criticalSafetyUpdates > 0) {
    items.push({
      id: 'rule-safety-update',
      type: 'safety',
      severity: 'info',
      title: '重大な安全情報の更新あり',
      message: `この計画の履歴の中で重大な安全対策（リスク管理）の更新が ${summary.criticalSafetyUpdates} 回あります。最新の対策が現場に周知されているか確認してください。`,
    });
  }

  // 3. High Velocity (Frequent structural changes)
  if (summary.structuralChanges >= 3 && summary.totalVersions <= 5) {
    items.push({
      id: 'rule-high-velocity',
      type: 'velocity',
      severity: 'success',
      title: '積極的な方針見直し',
      message: '短期間に複数の構造的変更が行われています。利用者の状況変化に合わせた積極的なPDCAが回っています。',
    });
  }

  // 4. Initial Baseline
  if (summary.totalVersions === 1) {
    items.push({
      id: 'rule-baseline',
      type: 'stagnation',
      severity: 'info',
      title: '初期計画フェーズ',
      message: '現在、この計画は最初のバージョンです。今後の経過観察を通じて変化を追跡していきます。',
    });
  }

  // Determine Overall Status
  let overallStatus: GuidanceSeverity = 'success';
  if (items.some(i => i.severity === 'critical')) overallStatus = 'critical';
  else if (items.some(i => i.severity === 'warn')) overallStatus = 'warn';
  else if (items.some(i => i.severity === 'info')) overallStatus = 'info';

  return { items, overallStatus };
}
