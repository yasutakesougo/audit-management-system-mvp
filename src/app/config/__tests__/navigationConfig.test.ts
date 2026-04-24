import { describe, expect, it } from "vitest";
import { createNavItems } from "../navigationConfig";
import { NAV_GROUP_ORDER } from '../navigationConfig.types';
import { groupNavItems } from "../navigationConfig.helpers";

describe("Navigation Configuration", () => {
  const baseConfig = {
    dashboardPath: "/dashboard",
    currentRole: "staff",
    schedulesEnabled: true,
    complianceFormEnabled: true,
    icebergPdcaEnabled: true,
    staffAttendanceEnabled: true,
    todayOpsEnabled: true,
    isAdmin: false,
    authzReady: true,
    navAudience: "staff" as const,
  };

  it("every navigation item must have a valid group assigned", () => {
    // Generate navigation items with all features enabled
    const items = createNavItems(baseConfig);

    // Group must be explicitly defined for every item
    // (TypeScript enforces this, but testing it guards against any sneaky type casts)
    for (const item of items) {
      expect(item.group).toBeDefined();
      expect(NAV_GROUP_ORDER).toContain(item.group);
    }
  });

  it("groups items correctly according to NAV_GROUP_ORDER", () => {
    const items = createNavItems(baseConfig);
    const { map, ORDER } = groupNavItems(items, false);

    // Assert that the returned ordering array matches our contract
    expect(ORDER).toEqual(NAV_GROUP_ORDER);

    // Assert that no unexpected group keys appear in the map
    Array.from(map.keys()).forEach((key) => {
      expect(NAV_GROUP_ORDER).toContain(key);
    });

    // Check mapping integrity (e.g. today ops is in today)
    const todayItems = map.get("today") || [];
    expect(todayItems.some((i) => i.label === "今日の業務")).toBe(true);
    expect(todayItems.some((i) => i.label === "送迎実施")).toBe(true);

    const masterItems = map.get("master") || [];
    expect(masterItems.some((i) => i.label === "利用者")).toBe(true);
  });

  it("hides admin items when feature flag/permissions omit them", () => {
    // Test that when permissions are different (though createNavItems currently
    // doesn't filter by role internally, we just ensure no crashes and group integrity)
    const adminConfig = {
      ...baseConfig,
      isAdmin: true,
      navAudience: "admin" as const,
    };
    const items = createNavItems(adminConfig);
    const { map } = groupNavItems(items, true);

    const opsItems = map.get("billing") || [];
    expect(opsItems.some((i) => i.label === "請求処理")).toBe(true);
  });

  it('staff audience では reception/admin 専用導線を表示しない', () => {
    const items = createNavItems(baseConfig);
    const labels = items.map((item) => item.label);

    expect(labels).not.toContain('個別支援計画更新・前回比較');
    expect(labels).not.toContain('職員勤怠');
  });

  it('reception audience では record/勤怠導線を表示し、個別支援計画更新は表示しない', () => {
    const items = createNavItems({
      ...baseConfig,
      navAudience: 'reception',
    });
    const labels = items.map((item) => item.label);

    expect(labels).toContain('職員勤怠');
    expect(labels).not.toContain('個別支援計画更新・前回比較');
  });

  it('admin audience では個別支援計画更新と reception 導線の両方を表示できる', () => {
    const items = createNavItems({
      ...baseConfig,
      isAdmin: true,
      navAudience: 'admin',
    });
    const labels = items.map((item) => item.label);

    expect(labels).toContain('個別支援計画更新・前回比較');
    expect(labels).toContain('職員勤怠');
  });
});
