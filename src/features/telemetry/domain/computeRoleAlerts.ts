/**
 * computeRoleAlerts — Role Breakdown から role 単位のアラートを生成する pure function
 *
 * v3.5 の KpiAlert 型を再利用し、アラート一覧に追加可能な形式で出力する。
 * 全体アラートと異なり、**誰に対する警告か** を明示する。
 *
 * @see computeCtaKpisByRole.ts — role 別 KPI 算出
 * @see computeCtaKpiDiff.ts   — 全体アラート（KpiAlert 型）
 */

import type { KpiAlert } from './computeCtaKpiDiff';
import type { RoleBreakdown, RoleId, RoleKpi } from './computeCtaKpisByRole';

// ── Types ───────────────────────────────────────────────────────────────────

export type RoleAlertThresholds = {
  /** role 別 Hero 利用率がこれを下回ると warning */
  heroRateMin: number;
  /** role 別 Queue 利用率がこれを上回ると warning */
  queueRateMax: number;
  /** role 別 完了率がこれを下回ると critical */
  completionRateMin: number;
  /** unknown role のCTAシェアがこれを上回ると warning */
  unknownShareMax: number;
  /** alert を発行する最小 CTA 数（ノイズ防止） */
  minCtaForAlert: number;
};

export const DEFAULT_ROLE_THRESHOLDS: RoleAlertThresholds = {
  heroRateMin: 70,
  queueRateMax: 40,
  completionRateMin: 50,
  unknownShareMax: 20,
  minCtaForAlert: 3,
};

// ── Role Labels ─────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<RoleId, string> = {
  staff: 'スタッフ',
  admin: '管理者',
  unknown: '不明',
};

// ── Remediation Suggestions ─────────────────────────────────────────────────

const REMEDIATION: Record<string, string> = {
  'role-hero-rate-low:staff':
    'Hero の文言・CTA 配置・優先度ロジックを見直してください。スタッフが Hero を使わず Queue から始めている可能性があります。',
  'role-hero-rate-low:admin':
    '管理画面の Hero 導線を確認してください。管理系ショートカットが Hero より先に見えている可能性があります。',
  'role-hero-rate-low:unknown':
    'Hero が使われていません。role 埋め込みが漏れている可能性もあります。',
  'role-queue-rate-high:staff':
    'Queue 偏重です。Hero の視認性・CTA コピーを改善するか、Queue 導線を補助的な位置に調整してください。',
  'role-queue-rate-high:admin':
    '管理者が Queue を多用しています。一覧導線やフィルタ機能の方が適切な可能性があります。',
  'role-queue-rate-high:unknown':
    'Queue 偏重です。role 付与を先に確認してください。',
  'role-completion-low:staff':
    'スタッフの完了率が低いです。入力負荷の軽減・必須項目の見直し・現場教育を検討してください。',
  'role-completion-low:admin':
    '管理者の完了率が低いです。承認フロー・一括操作の導線を確認してください。',
  'role-completion-low:unknown':
    '完了率が低いです。role 情報が欠落しているため、まず role 埋め込み漏れの調査を優先してください。',
};

function getRemediation(alertType: string, role: RoleId): string {
  return REMEDIATION[`${alertType}:${role}`] ?? '';
}

// ── Core Function ───────────────────────────────────────────────────────────

function checkRoleKpi(
  kpi: RoleKpi,
  thresholds: RoleAlertThresholds,
): KpiAlert[] {
  const alerts: KpiAlert[] = [];
  const label = ROLE_LABELS[kpi.role];

  // ノイズ防止: CTA が少なすぎる role はスキップ
  if (kpi.totalCtaClicks < thresholds.minCtaForAlert) return alerts;

  // Hero 利用率低下
  if (kpi.heroRate < thresholds.heroRateMin) {
    const remediation = getRemediation('role-hero-rate-low', kpi.role);
    alerts.push({
      id: `role-hero-rate-low:${kpi.role}`,
      severity: 'warning',
      label: `${label} Hero 利用率低下`,
      message: `${label}の Hero 利用率が ${kpi.heroRate}% です（閾値: ${thresholds.heroRateMin}%）。${remediation}`,
      value: kpi.heroRate,
      threshold: thresholds.heroRateMin,
    });
  }

  // Queue 偏重
  if (kpi.queueRate > thresholds.queueRateMax) {
    const remediation = getRemediation('role-queue-rate-high', kpi.role);
    alerts.push({
      id: `role-queue-rate-high:${kpi.role}`,
      severity: 'warning',
      label: `${label} Queue 偏重`,
      message: `${label}の Queue 利用率が ${kpi.queueRate}% です（閾値: ${thresholds.queueRateMax}%）。${remediation}`,
      value: kpi.queueRate,
      threshold: thresholds.queueRateMax,
    });
  }

  // 完了率低下
  if (kpi.completionRate < thresholds.completionRateMin) {
    const remediation = getRemediation('role-completion-low', kpi.role);
    alerts.push({
      id: `role-completion-low:${kpi.role}`,
      severity: 'critical',
      label: `${label} 完了率低下`,
      message: `${label}の完了率が ${kpi.completionRate}% です（閾値: ${thresholds.completionRateMin}%）。${remediation}`,
      value: kpi.completionRate,
      threshold: thresholds.completionRateMin,
    });
  }

  return alerts;
}

/**
 * RoleBreakdown から role 別アラートを生成する
 *
 * - 各 role の hero / queue / completion を閾値チェック
 * - unknown のCTAシェアが高すぎる場合の警告を追加
 * - minCtaForAlert 未満の role はスキップ（ノイズ防止）
 */
export function computeRoleAlerts(
  breakdown: RoleBreakdown,
  thresholds: RoleAlertThresholds = DEFAULT_ROLE_THRESHOLDS,
): KpiAlert[] {
  const alerts: KpiAlert[] = [];

  // ── 各 role のKPIチェック ──
  for (const kpi of breakdown) {
    alerts.push(...checkRoleKpi(kpi, thresholds));
  }

  // ── unknown シェアチェック ──
  const totalCta = breakdown.reduce((sum, k) => sum + k.totalCtaClicks, 0);
  const unknownKpi = breakdown.find((k) => k.role === 'unknown');

  if (unknownKpi && totalCta > 0) {
    const unknownShare = Math.round((unknownKpi.totalCtaClicks / totalCta) * 100);
    if (unknownShare > thresholds.unknownShareMax) {
      alerts.push({
        id: 'unknown-role-share-high',
        severity: 'warning',
        label: 'role 不明の割合が高い',
        message: `role 未設定のCTAが全体の ${unknownShare}% を占めています（閾値: ${thresholds.unknownShareMax}%）。テレメトリの role 埋め込みを確認してください。`,
        value: unknownShare,
        threshold: thresholds.unknownShareMax,
      });
    }
  }

  return alerts;
}
