/**
 * PR1 最小テスト：buildDashboardSections と getDashboardAnchorIdByKey の契約確認
 */

import { describe, it, expect } from 'vitest';
import {
  DASHBOARD_SECTIONS,
  buildDashboardSections,
  getDashboardAnchorIdByKey,
} from './buildSections';
import type { DashboardSectionKey } from './types';

describe('Dashboard Sections Builder (PR1)', () => {
  describe('getDashboardAnchorIdByKey', () => {
    it('常に 8 個全てのセクション key を持つ', () => {
      const anchorIds = getDashboardAnchorIdByKey();
      const keys = Object.keys(anchorIds);

      expect(keys).toHaveLength(8);
      expect(keys).toEqual(
        expect.arrayContaining([
          'safety',
          'attendance',
          'daily',
          'schedule',
          'handover',
          'stats',
          'adminOnly',
          'staffOnly',
        ]),
      );
    });

    it('anchorId は重複がない（一意）', () => {
      const anchorIds = getDashboardAnchorIdByKey();
      const values = Object.values(anchorIds);

      expect(new Set(values).size).toBe(values.length);
    });

    it('admin ロール時も staffOnly の anchor が存在', () => {
      const anchorIds = getDashboardAnchorIdByKey();

      expect(anchorIds.staffOnly).toBe('sec-staff');
      expect(anchorIds.adminOnly).toBe('sec-admin');
    });
  });

  describe('buildDashboardSections', () => {
    it('admin ロール時に adminOnly は表示、staffOnly は非表示', () => {
      const sections = buildDashboardSections({ role: 'admin' });
      const keys = sections.map((s) => s.key);

      expect(keys).toContain('adminOnly');
      expect(keys).not.toContain('staffOnly');
    });

    it('staff ロール時に staffOnly は表示、adminOnly は非表示', () => {
      const sections = buildDashboardSections({ role: 'staff' });
      const keys = sections.map((s) => s.key);

      expect(keys).toContain('staffOnly');
      expect(keys).not.toContain('adminOnly');
    });

    it('both audience は両ロルで表示される', () => {
      const sectionsAdmin = buildDashboardSections({ role: 'admin' });
      const sectionsStaff = buildDashboardSections({ role: 'staff' });

      const keysAdmin = sectionsAdmin.map((s) => s.key);
      const keysStaff = sectionsStaff.map((s) => s.key);

      const bothSections: DashboardSectionKey[] = [
        'safety',
        'attendance',
        'daily',
        'schedule',
        'handover',
        'stats',
      ];

      for (const key of bothSections) {
        expect(keysAdmin).toContain(key);
        expect(keysStaff).toContain(key);
      }
    });

    it('admin ロール時は 7 セクション返す（adminOnly含む）', () => {
      const sections = buildDashboardSections({ role: 'admin' });

      expect(sections).toHaveLength(7);
    });

    it('staff ロール時は 7 セクション返す（staffOnly含む）', () => {
      const sections = buildDashboardSections({ role: 'staff' });

      expect(sections).toHaveLength(7);
    });
  });

  describe('DASHBOARD_SECTIONS 定数', () => {
    it('8 セクション定義を含む', () => {
      expect(DASHBOARD_SECTIONS).toHaveLength(8);
    });

    it('全セクション key が定義されている', () => {
      const keys = DASHBOARD_SECTIONS.map((s) => s.key);

      expect(keys).toEqual(
        expect.arrayContaining([
          'safety',
          'attendance',
          'daily',
          'schedule',
          'handover',
          'stats',
          'adminOnly',
          'staffOnly',
        ]),
      );
    });

    it('anchorId は sec- prefix で統一されている', () => {
      for (const section of DASHBOARD_SECTIONS) {
        expect(section.anchorId).toMatch(/^sec-/);
      }
    });

    it('audience が適切に設定されている', () => {
      const adminOnlySection = DASHBOARD_SECTIONS.find(
        (s) => s.key === 'adminOnly',
      );
      const staffOnlySection = DASHBOARD_SECTIONS.find(
        (s) => s.key === 'staffOnly',
      );
      const bothSection = DASHBOARD_SECTIONS.find((s) => s.key === 'safety');

      expect(adminOnlySection?.audience).toBe('admin');
      expect(staffOnlySection?.audience).toBe('staff');
      expect(bothSection?.audience).toBe('both');
    });
  });

  describe('統合テスト：anchor の completeness', () => {
    it('すべての DashboardSectionKey が getDashboardAnchorIdByKey で取得可能', () => {
      const anchorIds = getDashboardAnchorIdByKey();

      // 全キーを手動で確認（TypeScript が型チェック）
      expect(anchorIds.safety).toBeDefined();
      expect(anchorIds.attendance).toBeDefined();
      expect(anchorIds.daily).toBeDefined();
      expect(anchorIds.schedule).toBeDefined();
      expect(anchorIds.handover).toBeDefined();
      expect(anchorIds.stats).toBeDefined();
      expect(anchorIds.adminOnly).toBeDefined();
      expect(anchorIds.staffOnly).toBeDefined();
    });

    it('scrollToSection(key) が undefined にならないシミュレーション', () => {
      const anchorIds = getDashboardAnchorIdByKey();
      const allKeys: DashboardSectionKey[] = [
        'safety',
        'attendance',
        'daily',
        'schedule',
        'handover',
        'stats',
        'adminOnly',
        'staffOnly',
      ];

      for (const key of allKeys) {
        const targetId = anchorIds[key];

        // scrollToSection 内での参照
        expect(targetId).toBeDefined();
        expect(typeof targetId).toBe('string');
        expect(targetId.length).toBeGreaterThan(0);
      }
    });
  });
});
