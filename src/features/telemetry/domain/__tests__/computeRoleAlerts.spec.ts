import { describe, it, expect } from 'vitest';
import { computeRoleAlerts, DEFAULT_ROLE_THRESHOLDS } from '../computeRoleAlerts';
import type { RoleBreakdown } from '../computeCtaKpisByRole';

// ── helpers ─────────────────────────────────────────────────────────────────

function mkKpi(
  role: 'staff' | 'admin' | 'unknown',
  overrides: Partial<{ heroRate: number; queueRate: number; completionRate: number; totalCtaClicks: number }> = {},
) {
  return {
    role,
    totalCtaClicks: overrides.totalCtaClicks ?? 10,
    heroRate: overrides.heroRate ?? 80,
    queueRate: overrides.queueRate ?? 20,
    completionRate: overrides.completionRate ?? 70,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('computeRoleAlerts', () => {
  it('正常な KPI ではアラートなし', () => {
    const breakdown: RoleBreakdown = [
      mkKpi('staff', { heroRate: 80, queueRate: 20, completionRate: 70 }),
      mkKpi('admin', { heroRate: 75, queueRate: 25, completionRate: 60 }),
    ];
    const alerts = computeRoleAlerts(breakdown);
    expect(alerts).toHaveLength(0);
  });

  it('staff の Hero 利用率低下で warning', () => {
    const breakdown: RoleBreakdown = [
      mkKpi('staff', { heroRate: 60 }),
    ];
    const alerts = computeRoleAlerts(breakdown);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].id).toBe('role-hero-rate-low:staff');
    expect(alerts[0].severity).toBe('warning');
    expect(alerts[0].message).toContain('スタッフ');
    expect(alerts[0].message).toContain('60%');
  });

  it('admin の Queue 偏重で warning', () => {
    const breakdown: RoleBreakdown = [
      mkKpi('admin', { queueRate: 55, heroRate: 45 }),
    ];
    const alerts = computeRoleAlerts(breakdown);
    const queueAlert = alerts.find((a) => a.id === 'role-queue-rate-high:admin');
    expect(queueAlert).toBeDefined();
    expect(queueAlert!.severity).toBe('warning');
    expect(queueAlert!.message).toContain('管理者');
  });

  it('staff の完了率低下で critical', () => {
    const breakdown: RoleBreakdown = [
      mkKpi('staff', { completionRate: 30 }),
    ];
    const alerts = computeRoleAlerts(breakdown);
    const compAlert = alerts.find((a) => a.id === 'role-completion-low:staff');
    expect(compAlert).toBeDefined();
    expect(compAlert!.severity).toBe('critical');
    expect(compAlert!.message).toContain('入力負荷');
  });

  it('unknown シェアが高い場合の warning', () => {
    const breakdown: RoleBreakdown = [
      mkKpi('staff', { totalCtaClicks: 3 }),
      mkKpi('unknown', { totalCtaClicks: 7 }),
    ];
    const alerts = computeRoleAlerts(breakdown);
    const shareAlert = alerts.find((a) => a.id === 'unknown-role-share-high');
    expect(shareAlert).toBeDefined();
    expect(shareAlert!.message).toContain('70%');
  });

  it('unknown シェアが閾値以下ならアラートなし', () => {
    const breakdown: RoleBreakdown = [
      mkKpi('staff', { totalCtaClicks: 90 }),
      mkKpi('unknown', { totalCtaClicks: 10 }),
    ];
    const alerts = computeRoleAlerts(breakdown);
    const shareAlert = alerts.find((a) => a.id === 'unknown-role-share-high');
    expect(shareAlert).toBeUndefined();
  });

  it('CTA が minCtaForAlert 未満の role はスキップ', () => {
    const breakdown: RoleBreakdown = [
      mkKpi('staff', { totalCtaClicks: 2, heroRate: 10, completionRate: 10 }),
    ];
    const alerts = computeRoleAlerts(breakdown);
    // CTA 2 < minCtaForAlert(3) → role KPI アラートなし
    expect(alerts.filter((a) => a.id.startsWith('role-'))).toHaveLength(0);
  });

  it('複数 role × 複数違反でアラートが積まれる', () => {
    const breakdown: RoleBreakdown = [
      mkKpi('staff', { heroRate: 50, completionRate: 30 }),
      mkKpi('admin', { queueRate: 60, heroRate: 40, completionRate: 40 }),
    ];
    const alerts = computeRoleAlerts(breakdown);
    // staff: hero-low + completion-low = 2
    // admin: hero-low + queue-high + completion-low = 3
    // total = 5
    expect(alerts).toHaveLength(5);
  });

  it('空配列ではアラートなし', () => {
    const alerts = computeRoleAlerts([]);
    expect(alerts).toHaveLength(0);
  });

  it('改善提案文が role ごとに異なる', () => {
    const breakdown: RoleBreakdown = [
      mkKpi('staff', { completionRate: 30 }),
      mkKpi('admin', { completionRate: 30 }),
    ];
    const alerts = computeRoleAlerts(breakdown);
    const staffAlert = alerts.find((a) => a.id === 'role-completion-low:staff');
    const adminAlert = alerts.find((a) => a.id === 'role-completion-low:admin');
    expect(staffAlert!.message).toContain('入力負荷');
    expect(adminAlert!.message).toContain('承認フロー');
    expect(staffAlert!.message).not.toEqual(adminAlert!.message);
  });

  it('カスタム閾値で alert 発火を制御できる', () => {
    const breakdown: RoleBreakdown = [
      mkKpi('staff', { heroRate: 60 }),
    ];
    // heroRateMin を 50 に緩めるとアラートなし
    const relaxed = computeRoleAlerts(breakdown, {
      ...DEFAULT_ROLE_THRESHOLDS,
      heroRateMin: 50,
    });
    expect(relaxed).toHaveLength(0);

    // heroRateMin を 70（デフォルト）ならアラートあり
    const strict = computeRoleAlerts(breakdown);
    expect(strict).toHaveLength(1);
  });
});
