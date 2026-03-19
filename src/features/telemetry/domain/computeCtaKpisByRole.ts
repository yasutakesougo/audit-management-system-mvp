/**
 * computeCtaKpisByRole — role 別に CTA KPI を分解する pure function
 *
 * 既存の computeCtaKpis を role ごとの部分集合に適用し、
 * Hero / Queue / 完了率をロール単位で可視化する。
 */

import { computeCtaKpis, type TelemetryRecord } from './computeCtaKpis';

// ── Types ───────────────────────────────────────────────────────────────────

export type RoleId = 'staff' | 'admin' | 'unknown';

export type RoleKpi = {
  role: RoleId;
  totalCtaClicks: number;
  heroRate: number;       // 0–100
  queueRate: number;      // 0–100
  completionRate: number; // 0–100
};

export type RoleBreakdown = RoleKpi[];

/** computeCtaKpis の入力に role を追加 */
export type TelemetryRecordWithRole = TelemetryRecord & {
  role?: RoleId;
};

// ── Constants ───────────────────────────────────────────────────────────────

/** 表示順 */
const ROLE_ORDER: RoleId[] = ['staff', 'admin', 'unknown'];

// ── Core Function ───────────────────────────────────────────────────────────

/**
 * テレメトリレコードを role で分割し、各 role の KPI を算出する
 *
 * - role がないレコードは 'unknown' にフォールバック
 * - CTA クリックが 0 の role は除外
 * - 出力は staff → admin → unknown の固定順
 */
export function computeCtaKpisByRole(
  records: TelemetryRecordWithRole[],
): RoleBreakdown {
  // ── 1. groupBy role ──
  const groups = new Map<RoleId, TelemetryRecordWithRole[]>();

  for (const rec of records) {
    const role = rec.role ?? 'unknown';
    const arr = groups.get(role);
    if (arr) {
      arr.push(rec);
    } else {
      groups.set(role, [rec]);
    }
  }

  // ── 2. 各 role で computeCtaKpis ──
  const results: RoleKpi[] = [];

  for (const role of ROLE_ORDER) {
    const roleRecords = groups.get(role);
    if (!roleRecords || roleRecords.length === 0) continue;

    const kpis = computeCtaKpis(roleRecords);

    // CTA クリックが 0 の role は除外
    if (kpis.totalCtaClicks === 0) continue;

    // 完了率: funnel[2].rate（CTA→完了）
    const completionRate = kpis.funnel[2]?.rate ?? 0;

    results.push({
      role,
      totalCtaClicks: kpis.totalCtaClicks,
      heroRate: kpis.heroQueueRatio.heroRate,
      queueRate: kpis.heroQueueRatio.queueRate,
      completionRate,
    });
  }

  return results;
}
