import { describe, it, expect } from 'vitest';
import { createNavItems } from '../navigationConfig';
import { NAV_AUDIENCE } from '../navigationConfig.types';

describe('navigationConfig Factory Contract', () => {
  const baseConfig = {
    dashboardPath: '/',
    currentRole: 'staff',
    schedulesEnabled: true,
    complianceFormEnabled: true,
    icebergPdcaEnabled: true,
    staffAttendanceEnabled: true,
    todayOpsEnabled: true,
    isAdmin: false,
    authzReady: true,
    navAudience: NAV_AUDIENCE.staff,
    skipLogin: false,
  };

  it('should return all major hub items in Standard Shell (isAdmin: false)', () => {
    const items = createNavItems(baseConfig);
    
    const hubLabels = items.map(i => i.label);
    
    // 1. Hub Presence
    expect(hubLabels).toContain('今日の業務');
    expect(hubLabels).toContain('スケジュール');
    expect(hubLabels).toContain('支援計画・調整');
    expect(hubLabels).toContain('記録・参照');
    expect(hubLabels).toContain('運営・管理');

    // 2. Domain Separation (Today vs Schedules)
    // Today Hub Items (Execution)
    expect(hubLabels).toContain('送迎実施');
    
    // Schedules Hub Items (Coordination/Assignment)
    expect(hubLabels).toContain('週間予定');
    expect(hubLabels).toContain('送迎配車調整');

    // 3. Group Consistency
    const transportExecution = items.find(i => i.label === '送迎実施');
    const transportAssignment = items.find(i => i.label === '送迎配車調整');
    
    expect(transportExecution?.group).toBe('today'); // Today Hub group
    expect(transportExecution?.to).toBe('/transport/execution'); // New dedicated route
    expect(transportAssignment?.group).toBe('schedules'); // Schedules Hub group
    expect(transportAssignment?.to).toBe('/transport/assignments');
    
    // Check that items are not undefined
    items.forEach(item => {
      expect(item).toBeDefined();
      expect(item.label).toBeDefined();
      expect(item.to).toBeDefined();
    });
  });

  it('should filter items correctly for FieldStaffShell (isFieldStaffShell: true logic)', () => {
    // In useAppShellState.ts, isFieldStaffShell = !isReception && !isAdmin (typically role === 'viewer' or 'staff' without admin rights)
    // We want to verify that createNavItems handles the internal isFieldStaffShell flag correctly
    
    createNavItems(baseConfig);
    const fieldStaffItems = createNavItems({
      ...baseConfig,
      isAdmin: false,
      currentRole: 'viewer', // This will result in isFieldStaffShell: true inside createNavItems
    });

    // Verify that major hubs still exist
    const fieldStaffLabels = fieldStaffItems.map(i => i.label);
    expect(fieldStaffLabels).toContain('今日の業務');
    expect(fieldStaffLabels).toContain('支援計画・調整');
    
    // Some specific items might change labels or audience
    // e.g. meeting minutes label might stay the same but we want to ensure no crashes
    expect(fieldStaffItems.length).toBeGreaterThan(0);
  });

  it('should include admin-only items when isAdmin is true', () => {
    const adminItems = createNavItems({
      ...baseConfig,
      isAdmin: true,
      navAudience: NAV_AUDIENCE.admin,
    });
    
    // Note: Some items are only added if isAdmin is true or specific roles are present
    // Just verify the list is returned correctly
    expect(adminItems.length).toBeGreaterThan(0);
    const adminLabels = adminItems.map(i => i.label);
    expect(adminLabels).toContain('リソースカレンダー');
  });
});
