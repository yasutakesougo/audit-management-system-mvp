import { describe, expect, it } from 'vitest';
import {
  HUB_DEFINITIONS,
  getHubAnalyticsName,
  getHubBreadcrumbLabel,
  getHubNavLabel,
  getHubPageTitle,
  getHubRequiredRole,
  getHubRootPath,
  getHubTelemetryName,
  getStandaloneHubIds,
  isHubPathActive,
  resolveHubVisibleEntries,
  resolveHubRouteMetadata,
} from '../hubDefinitions';

describe('hubDefinitions', () => {
  it('exposes root path / role / nav label from a single dictionary', () => {
    expect(getHubRootPath('billing')).toBe('/billing');
    expect(getHubRequiredRole('platform')).toBe('admin');
    expect(getHubNavLabel('today')).toBe('今日の業務');
    expect(getHubPageTitle('planning')).toBe('Planning');
    expect(getHubBreadcrumbLabel('planning')).toBe('Planning');
    expect(getHubTelemetryName('planning')).toBe('hub_planning_view');
    expect(getHubAnalyticsName('planning')).toBe('hub_planning');
  });

  it('matches hub active paths from dictionary config', () => {
    expect(isHubPathActive('records', '/records/monthly')).toBe(true);
    expect(isHubPathActive('planning', '/support-plan-guide')).toBe(true);
  });

  it('respects inactive path exclusions', () => {
    expect(isHubPathActive('platform', '/admin/navigation-diagnostics')).toBe(true);
    expect(isHubPathActive('platform', '/admin/exception-center')).toBe(false);
    expect(isHubPathActive('master', '/staff/attendance')).toBe(false);
  });

  it('resolves pathname to hub route metadata', () => {
    expect(resolveHubRouteMetadata('/planning')).toEqual({
      hubId: 'planning',
      pageTitle: 'Planning',
      breadcrumbLabel: 'Planning',
      telemetryName: 'hub_planning_view',
      analyticsName: 'hub_planning',
    });
    expect(resolveHubRouteMetadata('/admin/exception-center')?.hubId).toBe('operations');
    expect(resolveHubRouteMetadata('/dashboard')).toBeNull();
  });

  it('exposes standalone hub ids for route generation', () => {
    expect(getStandaloneHubIds()).toEqual(['planning', 'operations', 'master', 'platform']);
  });

  it('keeps fixed one-line purpose text for each hub header', () => {
    expect(HUB_DEFINITIONS.today.purpose).toBe('今やることを確認する');
    expect(HUB_DEFINITIONS.records.purpose).toBe('記録を書く・確認する');
    expect(HUB_DEFINITIONS.planning.purpose).toBe('計画を作成・見直しする');
    expect(HUB_DEFINITIONS.operations.purpose).toBe('運営状況を把握・調整する');
    expect(HUB_DEFINITIONS.billing.purpose).toBe('請求・精算を行う');
    expect(HUB_DEFINITIONS.master.purpose).toBe('マスタ情報を管理する');
    expect(HUB_DEFINITIONS.platform.purpose).toBe('システム設定と運用基盤を扱う');
  });

  it('resolves primary/secondary/comingSoon entries by role and policy', () => {
    const planningViewer = resolveHubVisibleEntries('planning', 'viewer');
    expect(planningViewer.primary.map((entry) => entry.id)).toEqual([
      'planning-guide',
      'planning-sheet-list',
      'planning-assessment',
    ]);
    expect(planningViewer.secondary.map((entry) => entry.id)).toEqual(['planning-analysis']);
    expect(planningViewer.comingSoon).toHaveLength(0);

    const billingReception = resolveHubVisibleEntries('billing', 'reception');
    expect(billingReception.primary.map((entry) => entry.id)).toEqual(['billing-main']);
    expect(billingReception.secondary.map((entry) => entry.id)).toEqual(['billing-service-record']);
    expect(billingReception.comingSoon.map((entry) => entry.id)).toEqual(['billing-reconciliation']);

    const billingViewer = resolveHubVisibleEntries('billing', 'viewer');
    expect(billingViewer.primary).toHaveLength(0);
    expect(billingViewer.secondary).toHaveLength(0);
    expect(billingViewer.comingSoon).toHaveLength(0);
  });

  it('keeps KPI-driven ordering deterministic by role', () => {
    const operationsReception = resolveHubVisibleEntries('operations', 'reception');
    expect(operationsReception.primary.map((entry) => entry.id)).toEqual([
      'operations-metrics',
      'operations-attendance',
      'operations-attendance-admin',
    ]);

    const operationsAdmin = resolveHubVisibleEntries('operations', 'admin');
    expect(operationsAdmin.primary.map((entry) => entry.id)).toEqual([
      'operations-metrics',
      'operations-attendance',
      'operations-attendance-admin',
      'operations-calendar',
    ]);
  });
});
