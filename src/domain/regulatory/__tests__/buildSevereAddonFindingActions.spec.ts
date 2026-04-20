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
    domain: 'sheet',
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
    // planningSheetId なし → 一覧ページ
    expect(actions[0].url).toBe('/planning-sheet-list');
    expect(actions[1].url).toContain('/analysis/iceberg-pdca');
  });

  it('tier2_candidate (with planningSheetId) → 個別シートページへ遷移', () => {
    const actions = buildSevereAddonFindingActions(
      makeFinding({ type: 'severe_addon_tier2_candidate', userId: 'U001', planningSheetId: 'PS-100' }),
    );
    expect(findByKind(actions, 'plan')).toHaveLength(1);
    expect(actions[0].url).toBe('/support-planning-sheet/PS-100');
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
    expect(actions[0].url).toBe('/staff');
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
    // planningSheetId なし → 一覧ページ
    expect(actions[0].url).toBe('/planning-sheet-list');
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
    expect(actions[0].url).toBe('/staff');
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

  // ── 作成者要件不備 ──

  it('authoring_requirement_unmet → review + staff', () => {
    const actions = buildSevereAddonFindingActions(
      makeFinding({
        type: 'authoring_requirement_unmet',
        userId: 'U006',
      }),
    );
    expect(actions).toHaveLength(2);
    expect(findByKind(actions, 'review')).toHaveLength(1);
    expect(findByKind(actions, 'staff')).toHaveLength(1);
    expect(actions[0].url).toBe('/planning-sheet-list');
    expect(actions[1].url).toBe('/staff');
  });

  // ── 資格なし配置 ──

  it('assignment_without_required_qualification → staff only', () => {
    const actions = buildSevereAddonFindingActions(
      makeFinding({
        type: 'assignment_without_required_qualification',
        userId: 'U007',
      }),
    );
    expect(actions).toHaveLength(1);
    expect(findByKind(actions, 'staff')).toHaveLength(1);
    expect(actions[0].url).toBe('/staff');
  });
});
