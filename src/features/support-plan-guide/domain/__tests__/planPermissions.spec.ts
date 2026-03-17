/**
 * planPermissions.spec.ts — 権限レイヤーのテスト
 */
import { describe, it, expect } from 'vitest';
import {
  resolvePlanRole,
  hasCap,
  isAtLeast,
  getCapabilities,
  type PlanRole,
  type PlanCapability,
} from '../planPermissions';

// ────────────────────────────────────────────
// resolvePlanRole
// ────────────────────────────────────────────

describe('resolvePlanRole', () => {
  it('isAdmin=true → admin', () => {
    expect(resolvePlanRole({ isAdmin: true })).toBe('admin');
  });

  it('isAdmin=false → staff', () => {
    expect(resolvePlanRole({ isAdmin: false })).toBe('staff');
  });

  it('roleHint があれば isAdmin より優先', () => {
    expect(resolvePlanRole({ isAdmin: false, roleHint: 'planner' })).toBe('planner');
    expect(resolvePlanRole({ isAdmin: true, roleHint: 'staff' })).toBe('staff');
  });

  it('roleHint=admin + isAdmin=false → admin', () => {
    expect(resolvePlanRole({ isAdmin: false, roleHint: 'admin' })).toBe('admin');
  });
});

// ────────────────────────────────────────────
// hasCap
// ────────────────────────────────────────────

describe('hasCap', () => {
  describe('staff capabilities', () => {
    const role: PlanRole = 'staff';

    it.each<PlanCapability>(['form.edit', 'form.save'])(
      '%s が許可される',
      (cap) => {
        expect(hasCap(role, cap)).toBe(true);
      },
    );

    it.each<PlanCapability>([
      'suggestions.view',
      'suggestions.decide',
      'suggestions.promote',
      'memo.view',
      'memo.act',
      'metrics.view',
      'ruleMetrics.view',
      'regulatoryHud.view',
      'settings.manage',
      'compliance.approve',
    ])('%s が拒否される', (cap) => {
      expect(hasCap(role, cap)).toBe(false);
    });
  });

  describe('planner capabilities', () => {
    const role: PlanRole = 'planner';

    it.each<PlanCapability>([
      'form.edit',
      'form.save',
      'suggestions.view',
      'suggestions.decide',
      'suggestions.promote',
      'memo.view',
      'memo.act',
      'metrics.view',
      'compliance.approve',
    ])('%s が許可される', (cap) => {
      expect(hasCap(role, cap)).toBe(true);
    });

    it.each<PlanCapability>([
      'ruleMetrics.view',
      'regulatoryHud.view',
      'settings.manage',
    ])('%s が拒否される', (cap) => {
      expect(hasCap(role, cap)).toBe(false);
    });
  });

  describe('admin capabilities', () => {
    const role: PlanRole = 'admin';

    it.each<PlanCapability>([
      'form.edit',
      'form.save',
      'suggestions.view',
      'suggestions.decide',
      'suggestions.promote',
      'memo.view',
      'memo.act',
      'metrics.view',
      'ruleMetrics.view',
      'regulatoryHud.view',
      'settings.manage',
      'compliance.approve',
    ])('%s が許可される', (cap) => {
      expect(hasCap(role, cap)).toBe(true);
    });
  });

  describe('admin は全 capability を含む', () => {
    it('admin ⊇ planner', () => {
      const plannerCaps = getCapabilities('planner');
      const adminCaps = getCapabilities('admin');
      for (const cap of plannerCaps) {
        expect(adminCaps.has(cap)).toBe(true);
      }
    });

    it('admin ⊇ staff', () => {
      const staffCaps = getCapabilities('staff');
      const adminCaps = getCapabilities('admin');
      for (const cap of staffCaps) {
        expect(adminCaps.has(cap)).toBe(true);
      }
    });

    it('planner ⊇ staff', () => {
      const staffCaps = getCapabilities('staff');
      const plannerCaps = getCapabilities('planner');
      for (const cap of staffCaps) {
        expect(plannerCaps.has(cap)).toBe(true);
      }
    });
  });
});

// ────────────────────────────────────────────
// isAtLeast
// ────────────────────────────────────────────

describe('isAtLeast', () => {
  it('admin ≥ admin', () => expect(isAtLeast('admin', 'admin')).toBe(true));
  it('admin ≥ planner', () => expect(isAtLeast('admin', 'planner')).toBe(true));
  it('admin ≥ staff', () => expect(isAtLeast('admin', 'staff')).toBe(true));

  it('planner ≥ planner', () => expect(isAtLeast('planner', 'planner')).toBe(true));
  it('planner ≥ staff', () => expect(isAtLeast('planner', 'staff')).toBe(true));
  it('planner < admin', () => expect(isAtLeast('planner', 'admin')).toBe(false));

  it('staff ≥ staff', () => expect(isAtLeast('staff', 'staff')).toBe(true));
  it('staff < planner', () => expect(isAtLeast('staff', 'planner')).toBe(false));
  it('staff < admin', () => expect(isAtLeast('staff', 'admin')).toBe(false));
});

// ────────────────────────────────────────────
// getCapabilities
// ────────────────────────────────────────────

describe('getCapabilities', () => {
  it('staff は 2 capability', () => {
    expect(getCapabilities('staff').size).toBe(2);
  });

  it('planner は 9 capability', () => {
    expect(getCapabilities('planner').size).toBe(9);
  });

  it('admin は 12 capability（全数）', () => {
    expect(getCapabilities('admin').size).toBe(12);
  });
});
