import { describe, it, expect } from 'vitest';
import {
  buildSevereAddonFindingActions,
  type AddonFindingAction,
} from '../buildSevereAddonFindingActions';
import type { SevereAddonFinding } from '../severeAddonFindings';

// ─────────────────────────────────────────────
// テストヘルパー
// ─────────────────────────────────────────────

function makeFinding(overrides: Partial<SevereAddonFinding>): SevereAddonFinding {
  return {
    id: 'test-finding-1',
    type: 'severe_addon_tier2_candidate',
    severity: 'low',
    userId: 'U001',
    message: 'テスト',
    detectedAt: '2026-03-13',
    ...overrides,
  };
}

function findByKind(actions: AddonFindingAction[], kind: string): AddonFindingAction[] {
  return actions.filter(a => a.kind === kind);
}

// ─────────────────────────────────────────────
// テスト
// ─────────────────────────────────────────────

describe('buildSevereAddonFindingActions', () => {
  // ── Tier 2 候補 ──

  it('tier2_candidate → plan + evidence', () => {
    const actions = buildSevereAddonFindingActions(
      makeFinding({ type: 'severe_addon_tier2_candidate', userId: 'U001' }),
    );
    expect(actions).toHaveLength(2);
    expect(findByKind(actions, 'plan')).toHaveLength(1);
    expect(findByKind(actions, 'evidence')).toHaveLength(1);
    expect(actions[0].url).toContain('/support-plan-guide');
    expect(actions[0].url).toContain('userId=U001');
    expect(actions[1].url).toContain('/analysis/iceberg-pdca');
  });

  // ── Tier 3 候補 ──

  it('tier3_candidate → plan + evidence', () => {
    const actions = buildSevereAddonFindingActions(
      makeFinding({ type: 'severe_addon_tier3_candidate', userId: 'U002' }),
    );
    expect(actions).toHaveLength(2);
    expect(findByKind(actions, 'plan')).toHaveLength(1);
    expect(findByKind(actions, 'evidence')).toHaveLength(1);
  });

  // ── 基礎研修比率不足 ──

  it('basic_training_ratio_insufficient → staff (事業所レベル)', () => {
    const actions = buildSevereAddonFindingActions(
      makeFinding({
        type: 'basic_training_ratio_insufficient',
        userId: '__facility__',
      }),
    );
    expect(actions).toHaveLength(1);
    expect(findByKind(actions, 'staff')).toHaveLength(1);
    expect(actions[0].url).toBe('/regulatory/staff');
  });

  // ── 再評価超過 ──

  it('planning_sheet_reassessment_overdue → review + evidence', () => {
    const actions = buildSevereAddonFindingActions(
      makeFinding({
        type: 'planning_sheet_reassessment_overdue',
        userId: 'U003',
      }),
    );
    expect(actions).toHaveLength(2);
    expect(findByKind(actions, 'review')).toHaveLength(1);
    expect(findByKind(actions, 'evidence')).toHaveLength(1);
    expect(actions[0].url).toContain('tab=reassessment');
  });

  // ── 週次観察不足 ──

  it('weekly_observation_shortage → review + evidence', () => {
    const actions = buildSevereAddonFindingActions(
      makeFinding({
        type: 'weekly_observation_shortage',
        userId: 'U004',
      }),
    );
    expect(actions).toHaveLength(2);
    expect(findByKind(actions, 'review')).toHaveLength(1);
    expect(findByKind(actions, 'evidence')).toHaveLength(1);
    expect(actions[0].url).toContain('tab=observation');
  });

  // ── source パラメータ ──

  it('evidence URL に source=regulatory-addon が含まれる', () => {
    const actions = buildSevereAddonFindingActions(
      makeFinding({ type: 'severe_addon_tier2_candidate', userId: 'U005' }),
    );
    const evidence = findByKind(actions, 'evidence')[0];
    expect(evidence.url).toContain('source=regulatory-addon');
  });

  // ── 事業所レベル finding は evidence なし ──

  it('__facility__ の finding はユーザー導線なし', () => {
    const actions = buildSevereAddonFindingActions(
      makeFinding({
        type: 'basic_training_ratio_insufficient',
        userId: '__facility__',
      }),
    );
    expect(findByKind(actions, 'evidence')).toHaveLength(0);
    expect(findByKind(actions, 'plan')).toHaveLength(0);
  });
});
