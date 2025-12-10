import { describe, expect, it } from 'vitest';

import { HYDRATION_KEYS, resolveHydrationEntry, type HydrationRouteEntry } from '@/hydration/routes';

describe('resolveHydrationEntry', () => {
  describe('基本ルートマッピング', () => {
    it.each<[string, string, HydrationRouteEntry, string]>([
      // ダッシュボード・ホーム
      ['/', '', HYDRATION_KEYS.dashboard, 'dashboard'],
      ['', '', HYDRATION_KEYS.dashboard, 'dashboard'],
      ['/dashboard', '', HYDRATION_KEYS.dashboard, 'dashboard'],

      // 記録・監査系
      ['/records', '', HYDRATION_KEYS.records, 'records'],
      ['/records/support-procedures', '', HYDRATION_KEYS.supportProcedures, 'supportProcedures'],
      ['/audit/logs', '', HYDRATION_KEYS.audit, 'audit'],
      ['/checklist/audit', '', HYDRATION_KEYS.checklist, 'checklist'],

      // ユーザー・スタッフ管理
      ['/users', '', HYDRATION_KEYS.users, 'users'],
      ['/staff/', '', HYDRATION_KEYS.staff, 'staff'],

      // スケジュール系（基本）
      ['/schedules/week', '', HYDRATION_KEYS.schedulesWeek, 'schedulesWeek'],
      ['/schedules/month', '', HYDRATION_KEYS.schedulesMonth, 'schedulesMonth'],
      ['/schedules/create', '', HYDRATION_KEYS.schedulesCreate, 'schedulesCreate'],
      ['/schedule/week', '', HYDRATION_KEYS.schedulesWeek, 'schedulesWeek'], // /schedule も対応

      // スケジュール系（/schedules/day 専用マッピング）
      ['/schedules/day', '', HYDRATION_KEYS.schedulesDay, 'schedulesDay'],

      // 日次メニュー系
      ['/daily', '', HYDRATION_KEYS.dailyMenu, 'dailyMenu'],
      ['/daily/support', '', HYDRATION_KEYS.dailySupport, 'dailySupport'],
      ['/daily/time-based', '', HYDRATION_KEYS.dailyTimeBased, 'dailyTimeBased'],
      ['/daily/activity', '', HYDRATION_KEYS.dailyActivity, 'dailyActivity'],
      ['/analysis/dashboard', '', HYDRATION_KEYS.analysisDashboard, 'analysisDashboard'],

      // 管理画面系
      ['/admin/dashboard', '', HYDRATION_KEYS.adminDashboard, 'adminDashboard'],
      [
        '/admin/integrated-resource-calendar',
        '',
        HYDRATION_KEYS.adminIntegratedResourceCalendar,
        'adminIntegratedResourceCalendar',
      ],
      ['/admin/templates', '', HYDRATION_KEYS.adminTemplates, 'adminTemplates'],
      ['/admin/step-templates', '', HYDRATION_KEYS.adminSteps, 'adminSteps'],
      ['/admin/individual-support', '', HYDRATION_KEYS.adminIndividualSupport, 'adminIndividualSupport'],

      // 引継ぎ系
      ['/handoff-timeline', '', HYDRATION_KEYS.handoffTimeline, 'handoffTimeline'],
    ])('resolves %s%s to %s', (pathname: string, search: string, expected: HydrationRouteEntry, description: string) => {
      const entry = resolveHydrationEntry(pathname, search);
      expect(entry, `${pathname}${search} should resolve to ${description}`).toEqual(expected);
    });
  });

  describe('view クエリパラメータによるスケジュール切り替え', () => {
    it.each<[string, string, HydrationRouteEntry, string]>([
      // view=day でschedulesDay エントリに切り替え
      ['/schedules/week', '?view=day', HYDRATION_KEYS.schedulesDay, 'day view'],
      ['/schedules/day', '?view=day', HYDRATION_KEYS.schedulesDay, 'day view'],
      ['/schedules/month', '?view=day', HYDRATION_KEYS.schedulesDay, 'day view'],

      // 大文字小文字無視
      ['/schedules/week', '?view=DAY', HYDRATION_KEYS.schedulesDay, 'day view (uppercase)'],
      ['/schedules/week', '?view=Day', HYDRATION_KEYS.schedulesDay, 'day view (mixed case)'],

      // view=day が複数パラメータに混在
      ['/schedules/week', '?tab=1&view=day&sort=date', HYDRATION_KEYS.schedulesDay, 'day view with other params'],

      // view パラメータなし = デフォルトエントリ（パスに応じたマッピング）
      ['/schedules/week', '?tab=1', HYDRATION_KEYS.schedulesWeek, 'no view param defaults to week'],
      ['/schedules/day', '?tab=1', HYDRATION_KEYS.schedulesDay, 'no view param - day path stays day'],
      ['/schedules/month', '?tab=1', HYDRATION_KEYS.schedulesMonth, 'no view param defaults to month'],
      ['/schedules/create', '?step=1', HYDRATION_KEYS.schedulesCreate, 'no view param defaults to create'],

      // 無効なview値 = デフォルトエントリ
      ['/schedules/week', '?view=invalid', HYDRATION_KEYS.schedulesWeek, 'invalid view defaults to week'],
      ['/schedules/month', '?view=invalid', HYDRATION_KEYS.schedulesMonth, 'invalid view defaults to month'],
    ])('resolves %s%s to %s for %s', (pathname: string, search: string, expected: HydrationRouteEntry, description: string) => {
      const entry = resolveHydrationEntry(pathname, search);
      expect(entry, `${pathname}${search} should resolve to ${description}`).toEqual(expected);
    });
  });

  describe('パス正規化', () => {
    it('normalizes casing and trailing slash', () => {
      const entry = resolveHydrationEntry('/DAILY/Support/', '');
      expect(entry).toEqual(HYDRATION_KEYS.dailySupport);
    });

    it('supports paths without a leading slash', () => {
      const entry = resolveHydrationEntry('schedules/week', '');
      expect(entry).toEqual(HYDRATION_KEYS.schedulesWeek);
    });

    it('handles mixed case paths correctly', () => {
      // パスの大文字小文字は正規化される
      const entry = resolveHydrationEntry('/SCHEDULES/Week', '?view=day');
      expect(entry).toEqual(HYDRATION_KEYS.schedulesDay);
    });

    it('query parameter keys are case sensitive', () => {
      // クエリパラメータのキー名は大文字小文字を区別することを明示
      const lowerCase = resolveHydrationEntry('/schedules/week', '?view=day');
      const upperCase = resolveHydrationEntry('/schedules/week', '?VIEW=day');

      expect(lowerCase, 'lowercase view= should work').toEqual(HYDRATION_KEYS.schedulesDay);
      expect(upperCase, 'uppercase VIEW= should fall back to default').toEqual(HYDRATION_KEYS.schedulesWeek);
    });
  });

  describe('エッジケース', () => {
    it('returns null for unmatched paths', () => {
      expect(resolveHydrationEntry('/unknown')).toBeNull();
    });

    it('returns null for empty/undefined inputs', () => {
      expect(resolveHydrationEntry('')).toEqual(HYDRATION_KEYS.dashboard); // 空文字はdashboard
      expect(resolveHydrationEntry('/nonexistent/path')).toBeNull();
    });

    it('handles malformed query strings gracefully', () => {
      const entry = resolveHydrationEntry('/schedules/week', '?view=day&malformed=');
      expect(entry).toEqual(HYDRATION_KEYS.schedulesDay);
    });
  });
});
