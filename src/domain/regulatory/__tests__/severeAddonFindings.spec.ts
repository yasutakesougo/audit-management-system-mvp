import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildSevereAddonFindings,
  summarizeSevereAddonFindings,
  _resetAddonFindingCounter,
  type SevereAddonBulkInput,
  type SevereAddonFinding,
  SEVERE_ADDON_FINDING_TYPE_LABELS,
} from '../severeAddonFindings';

// ─────────────────────────────────────────────
// テストヘルパー
// ─────────────────────────────────────────────

function makeBaseInput(overrides?: Partial<SevereAddonBulkInput>): SevereAddonBulkInput {
  return {
    users: [],
    totalLifeSupportStaff: 10,
    basicTrainingCompletedCount: 3,
    usersWithoutWeeklyObservation: [],
    lastReassessmentMap: new Map(),
    today: '2026-03-13',
    ...overrides,
  };
}

function findByType(findings: SevereAddonFinding[], type: string): SevereAddonFinding[] {
  return findings.filter(f => f.type === type);
}

// ─────────────────────────────────────────────
// テスト
// ─────────────────────────────────────────────

describe('buildSevereAddonFindings', () => {
  beforeEach(() => {
    _resetAddonFindingCounter();
  });

  // ── 基礎研修比率 ──

  it('基礎研修比率 20% 以上 → finding なし', () => {
    const findings = buildSevereAddonFindings(makeBaseInput({
      totalLifeSupportStaff: 10,
      basicTrainingCompletedCount: 2, // 20%
    }));
    expect(findByType(findings, 'basic_training_ratio_insufficient')).toHaveLength(0);
  });

  it('基礎研修比率 20% 未満 → finding あり', () => {
    const findings = buildSevereAddonFindings(makeBaseInput({
      totalLifeSupportStaff: 10,
      basicTrainingCompletedCount: 1, // 10%
    }));
    const ratioFindings = findByType(findings, 'basic_training_ratio_insufficient');
    expect(ratioFindings).toHaveLength(1);
    expect(ratioFindings[0].severity).toBe('medium');
    expect(ratioFindings[0].userId).toBe('__facility__');
    expect(ratioFindings[0].message).toContain('10.0%');
  });

  it('全員修了 → finding なし', () => {
    const findings = buildSevereAddonFindings(makeBaseInput({
      totalLifeSupportStaff: 5,
      basicTrainingCompletedCount: 5, // 100%
    }));
    expect(findByType(findings, 'basic_training_ratio_insufficient')).toHaveLength(0);
  });

  // ── 加算候補 ──

  it('区分6・行動12 → tier2候補', () => {
    const findings = buildSevereAddonFindings(makeBaseInput({
      users: [{ userId: 'U001', supportLevel: '6', behaviorScore: 12, planningSheetIds: [] }],
    }));
    const candidates = findByType(findings, 'severe_addon_tier2_candidate');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].severity).toBe('low');
    expect(candidates[0].message).toContain('加算（Ⅱ）候補');
  });

  it('区分5・行動12 → tier3候補（tier2ではない）', () => {
    const findings = buildSevereAddonFindings(makeBaseInput({
      users: [{ userId: 'U002', supportLevel: '5', behaviorScore: 12, planningSheetIds: [] }],
    }));
    expect(findByType(findings, 'severe_addon_tier2_candidate')).toHaveLength(0);
    const candidates = findByType(findings, 'severe_addon_tier3_candidate');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].message).toContain('加算（Ⅲ）候補');
  });

  it('区分6・行動18 → 上位区分表示', () => {
    const findings = buildSevereAddonFindings(makeBaseInput({
      users: [{ userId: 'U003', supportLevel: '6', behaviorScore: 18, planningSheetIds: [] }],
    }));
    const candidates = findByType(findings, 'severe_addon_tier2_candidate');
    expect(candidates).toHaveLength(1);
    expect(candidates[0].message).toContain('上位区分');
  });

  it('区分3・行動5 → 候補なし', () => {
    const findings = buildSevereAddonFindings(makeBaseInput({
      users: [{ userId: 'U004', supportLevel: '3', behaviorScore: 5, planningSheetIds: [] }],
    }));
    expect(findByType(findings, 'severe_addon_tier2_candidate')).toHaveLength(0);
    expect(findByType(findings, 'severe_addon_tier3_candidate')).toHaveLength(0);
  });

  it('非候補利用者は週次観察・再評価チェックをスキップする', () => {
    const findings = buildSevereAddonFindings(makeBaseInput({
      users: [{ userId: 'U005', supportLevel: '3', behaviorScore: 5, planningSheetIds: [] }],
      usersWithoutWeeklyObservation: ['U005'],
      lastReassessmentMap: new Map([['U005', null]]),
    }));
    expect(findByType(findings, 'weekly_observation_shortage')).toHaveLength(0);
    expect(findByType(findings, 'planning_sheet_reassessment_overdue')).toHaveLength(0);
  });

  // ── 週次観察不足 ──

  it('候補利用者で週次観察不足 → finding あり', () => {
    const findings = buildSevereAddonFindings(makeBaseInput({
      users: [{ userId: 'U006', supportLevel: '6', behaviorScore: 12, planningSheetIds: [] }],
      usersWithoutWeeklyObservation: ['U006'],
    }));
    const obs = findByType(findings, 'weekly_observation_shortage');
    expect(obs).toHaveLength(1);
    expect(obs[0].severity).toBe('medium');
  });

  it('候補利用者で週次観察あり → finding なし', () => {
    const findings = buildSevereAddonFindings(makeBaseInput({
      users: [{ userId: 'U007', supportLevel: '6', behaviorScore: 12, planningSheetIds: [] }],
      usersWithoutWeeklyObservation: [], // 不足なし
    }));
    expect(findByType(findings, 'weekly_observation_shortage')).toHaveLength(0);
  });

  // ── 3か月再評価超過 ──

  it('候補利用者で再評価未実施 → finding あり (high)', () => {
    const findings = buildSevereAddonFindings(makeBaseInput({
      users: [{ userId: 'U008', supportLevel: '6', behaviorScore: 12, planningSheetIds: [] }],
      lastReassessmentMap: new Map([['U008', null]]),
    }));
    const overdue = findByType(findings, 'planning_sheet_reassessment_overdue');
    expect(overdue).toHaveLength(1);
    expect(overdue[0].severity).toBe('high');
    expect(overdue[0].message).toContain('再評価未実施');
  });

  it('候補利用者で91日前の再評価 → finding あり', () => {
    const findings = buildSevereAddonFindings(makeBaseInput({
      users: [{ userId: 'U009', supportLevel: '6', behaviorScore: 12, planningSheetIds: [] }],
      lastReassessmentMap: new Map([['U009', '2025-12-13']]), // 90日前 = 2026-03-13 → ちょうど90日で OK
      today: '2026-03-14', // → 91日 → overdue
    }));
    const overdue = findByType(findings, 'planning_sheet_reassessment_overdue');
    expect(overdue).toHaveLength(1);
    expect(overdue[0].message).toContain('91日経過');
  });

  it('候補利用者で89日前の再評価 → finding なし', () => {
    const findings = buildSevereAddonFindings(makeBaseInput({
      users: [{ userId: 'U010', supportLevel: '6', behaviorScore: 12, planningSheetIds: [] }],
      lastReassessmentMap: new Map([['U010', '2025-12-14']]),
      today: '2026-03-13', // → 89日 → OK
    }));
    expect(findByType(findings, 'planning_sheet_reassessment_overdue')).toHaveLength(0);
  });

  it('再評価マップに載っていない利用者は再評価未実施扱い', () => {
    const findings = buildSevereAddonFindings(makeBaseInput({
      users: [{ userId: 'U011', supportLevel: '6', behaviorScore: 12, planningSheetIds: [] }],
      lastReassessmentMap: new Map(), // 空マップ
    }));
    const overdue = findByType(findings, 'planning_sheet_reassessment_overdue');
    expect(overdue).toHaveLength(1);
    expect(overdue[0].message).toContain('再評価未実施');
  });

  // ── 複合ケース ──

  it('複数利用者 + 比率不足 → 複合 findings', () => {
    const findings = buildSevereAddonFindings(makeBaseInput({
      users: [
        { userId: 'U012', supportLevel: '6', behaviorScore: 12, planningSheetIds: ['ps-1'] },
        { userId: 'U013', supportLevel: '4', behaviorScore: 10, planningSheetIds: ['ps-2'] },
        { userId: 'U014', supportLevel: '3', behaviorScore: 5, planningSheetIds: [] },
      ],
      totalLifeSupportStaff: 10,
      basicTrainingCompletedCount: 1, // 10% → 不足
      usersWithoutWeeklyObservation: ['U012'],
      lastReassessmentMap: new Map([
        ['U012', null],
        ['U013', '2026-01-01'],
      ]),
      today: '2026-03-13',
    }));

    // 基礎研修比率不足（事業所）
    expect(findByType(findings, 'basic_training_ratio_insufficient')).toHaveLength(1);
    // U012: tier2 候補 + 週次観察不足 + 再評価未実施
    expect(findByType(findings, 'severe_addon_tier2_candidate')).toHaveLength(1);
    expect(findByType(findings, 'weekly_observation_shortage')).toHaveLength(1);
    // U013: tier3 候補 + 再評価超過（1/1→3/13 = 71日 → OK）
    expect(findByType(findings, 'severe_addon_tier3_candidate')).toHaveLength(1);
    // U014: 対象外 → 候補なし
    // U012 の再評価は overdue
    const overdue = findByType(findings, 'planning_sheet_reassessment_overdue');
    expect(overdue).toHaveLength(1);
    expect(overdue[0].userId).toBe('U012');
  });

  // ── userName伝播 ──

  it('userName が findings に伝播する', () => {
    const findings = buildSevereAddonFindings(makeBaseInput({
      users: [{
        userId: 'U015',
        userName: '田中太郎',
        supportLevel: '6',
        behaviorScore: 12,
        planningSheetIds: [],
      }],
    }));
    const candidates = findByType(findings, 'severe_addon_tier2_candidate');
    expect(candidates[0].userName).toBe('田中太郎');
  });

  // ── ID の一意性 ──

  it('全 finding の ID が一意', () => {
    const findings = buildSevereAddonFindings(makeBaseInput({
      users: [
        { userId: 'U016', supportLevel: '6', behaviorScore: 12, planningSheetIds: [] },
        { userId: 'U017', supportLevel: '5', behaviorScore: 10, planningSheetIds: [] },
      ],
      usersWithoutWeeklyObservation: ['U016'],
      lastReassessmentMap: new Map([['U016', null]]),
      totalLifeSupportStaff: 10,
      basicTrainingCompletedCount: 1,
    }));

    const ids = findings.map(f => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─────────────────────────────────────────────
// summarizeSevereAddonFindings
// ─────────────────────────────────────────────

describe('summarizeSevereAddonFindings', () => {
  beforeEach(() => {
    _resetAddonFindingCounter();
  });

  it('空の findings → 全て 0', () => {
    const summary = summarizeSevereAddonFindings([]);
    expect(summary.tier2CandidateCount).toBe(0);
    expect(summary.tier3CandidateCount).toBe(0);
    expect(summary.totalFindings).toBe(0);
  });

  it('複合 findings のカウントが正しい', () => {
    const findings = buildSevereAddonFindings(makeBaseInput({
      users: [
        { userId: 'U001', supportLevel: '6', behaviorScore: 12, planningSheetIds: [] },
        { userId: 'U002', supportLevel: '5', behaviorScore: 10, planningSheetIds: [] },
        { userId: 'U003', supportLevel: '4', behaviorScore: 15, planningSheetIds: [] },
      ],
      totalLifeSupportStaff: 10,
      basicTrainingCompletedCount: 1, // 10%
      usersWithoutWeeklyObservation: ['U001'],
      lastReassessmentMap: new Map([['U001', null]]),
    }));

    const summary = summarizeSevereAddonFindings(findings);

    expect(summary.tier2CandidateCount).toBe(1);               // U001
    expect(summary.tier3CandidateCount).toBe(2);               // U002, U003
    expect(summary.trainingRatioInsufficientCount).toBe(1);    // 事業所全体
    expect(summary.weeklyObservationShortageCount).toBe(1);    // U001
    expect(summary.reassessmentOverdueCount).toBe(3);          // U001, U002, U003（全員マップ未登録）
    expect(summary.totalFindings).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
// ラベル定数
// ─────────────────────────────────────────────

describe('SEVERE_ADDON_FINDING_TYPE_LABELS', () => {
  it('全種別にラベルが定義されている', () => {
    const types = [
      'severe_addon_tier2_candidate',
      'severe_addon_tier3_candidate',
      'basic_training_ratio_insufficient',
      'planning_sheet_reassessment_overdue',
      'weekly_observation_shortage',
    ] as const;

    for (const type of types) {
      expect(SEVERE_ADDON_FINDING_TYPE_LABELS[type]).toBeDefined();
      expect(typeof SEVERE_ADDON_FINDING_TYPE_LABELS[type]).toBe('string');
    }
  });
});
