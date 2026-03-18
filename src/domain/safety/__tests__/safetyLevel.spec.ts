/**
 * safetyLevel.ts — overallLevel / actionRequiredCount 純関数テスト
 *
 * テストの目的:
 *   「適正化レベルが critical > warning > good の優先順序を守ること」を
 *   仕様として固定する。
 *
 *   将来のリファクタや条件追加時に、この契約が崩れていないかを検知する。
 *
 * 法的根拠:
 *   - 身体拘束 未承認・三要件未充足 → 即座に critical（実地指導で最初に確認される）
 *   - インシデント 未対応フォローアップ → critical
 *   - 委員会・指針・研修の要件未達 → warning（許容されるが改善必要）
 *
 * テスト設計書: docs/test-design/safety.md
 */
import { describe, it, expect } from 'vitest';
import {
  computeOverallLevel,
  computeActionRequiredCount,
  type SafetyLevelInput,
} from '../safetyLevel';

// ─── テスト用ファクトリ ───────────────────────────────────────────────────────

/** 「すべて良好」な入力を生成する基底値 */
function makeInput(overrides?: Partial<SafetyLevelInput>): SafetyLevelInput {
  return {
    incident: { pendingFollowUp: 0 },
    restraint: { pendingApproval: 0, incompleteRequirements: 0 },
    committee: { meetsQuarterlyRequirement: true },
    guideline: { allItemsFulfilled: true },
    training: { meetsBiannualRequirement: true },
    ...overrides,
  };
}

// ─── computeOverallLevel ─────────────────────────────────────────────────────

describe('computeOverallLevel', () => {
  // ── good ────────────────────────────────────────────────────────────────

  describe('good', () => {
    it('should return good when all conditions are satisfied', () => {
      expect(computeOverallLevel(makeInput())).toBe('good');
    });
  });

  // ── warning ─────────────────────────────────────────────────────────────

  describe('warning', () => {
    it('should return warning when committee does not meet quarterly requirement', () => {
      const input = makeInput({ committee: { meetsQuarterlyRequirement: false } });
      expect(computeOverallLevel(input)).toBe('warning');
    });

    it('should return warning when guideline items are not fulfilled', () => {
      const input = makeInput({ guideline: { allItemsFulfilled: false } });
      expect(computeOverallLevel(input)).toBe('warning');
    });

    it('should return warning when training does not meet biannual requirement', () => {
      const input = makeInput({ training: { meetsBiannualRequirement: false } });
      expect(computeOverallLevel(input)).toBe('warning');
    });

    it('should return warning when multiple warning conditions are present', () => {
      const input = makeInput({
        committee: { meetsQuarterlyRequirement: false },
        guideline: { allItemsFulfilled: false },
        training: { meetsBiannualRequirement: false },
      });
      expect(computeOverallLevel(input)).toBe('warning');
    });
  });

  // ── critical ────────────────────────────────────────────────────────────

  describe('critical', () => {
    it('should return critical when incident has pending follow-up', () => {
      const input = makeInput({ incident: { pendingFollowUp: 1 } });
      expect(computeOverallLevel(input)).toBe('critical');
    });

    it('should return critical when restraint has pending approval', () => {
      const input = makeInput({ restraint: { pendingApproval: 1, incompleteRequirements: 0 } });
      expect(computeOverallLevel(input)).toBe('critical');
    });

    it('should return critical when restraint has incomplete requirements', () => {
      const input = makeInput({ restraint: { pendingApproval: 0, incompleteRequirements: 1 } });
      expect(computeOverallLevel(input)).toBe('critical');
    });

    it('should return critical when multiple critical conditions are present', () => {
      const input = makeInput({
        incident: { pendingFollowUp: 2 },
        restraint: { pendingApproval: 1, incompleteRequirements: 3 },
      });
      expect(computeOverallLevel(input)).toBe('critical');
    });
  });

  // ── 優先順位: critical > warning ─────────────────────────────────────────

  describe('priority: critical beats warning', () => {
    it('should return critical even when warning conditions also exist (critical + committee)', () => {
      const input = makeInput({
        incident: { pendingFollowUp: 1 },
        committee: { meetsQuarterlyRequirement: false }, // warning 条件
      });
      expect(computeOverallLevel(input)).toBe('critical');
    });

    it('should return critical even when warning conditions also exist (critical + guideline)', () => {
      const input = makeInput({
        restraint: { pendingApproval: 0, incompleteRequirements: 1 },
        guideline: { allItemsFulfilled: false }, // warning 条件
      });
      expect(computeOverallLevel(input)).toBe('critical');
    });

    it('should return critical even when all warning conditions are present simultaneously', () => {
      const input = makeInput({
        incident: { pendingFollowUp: 1 },
        // すべての warning 条件も true
        committee: { meetsQuarterlyRequirement: false },
        guideline: { allItemsFulfilled: false },
        training: { meetsBiannualRequirement: false },
      });
      expect(computeOverallLevel(input)).toBe('critical');
    });

    it('should return warning (not good) when critical clears but warning remains', () => {
      // critical が解消されたとき → warning に降格（good にはならない）
      const input = makeInput({
        incident: { pendingFollowUp: 0 },   // critical 解消
        committee: { meetsQuarterlyRequirement: false }, // warning 残存
      });
      expect(computeOverallLevel(input)).toBe('warning');
    });
  });

  // ── 件数の境界値 ─────────────────────────────────────────────────────────

  describe('count boundaries', () => {
    it('should return good when pendingFollowUp = 0 (boundary: 0 is not critical)', () => {
      expect(computeOverallLevel(makeInput({ incident: { pendingFollowUp: 0 } }))).toBe('good');
    });

    it('should return critical when pendingFollowUp = 1 (boundary: 1 triggers critical)', () => {
      expect(computeOverallLevel(makeInput({ incident: { pendingFollowUp: 1 } }))).toBe('critical');
    });

    it('should return good when pendingApproval = 0 (boundary)', () => {
      expect(computeOverallLevel(makeInput({
        restraint: { pendingApproval: 0, incompleteRequirements: 0 },
      }))).toBe('good');
    });

    it('should return critical when pendingApproval = 1 (boundary)', () => {
      expect(computeOverallLevel(makeInput({
        restraint: { pendingApproval: 1, incompleteRequirements: 0 },
      }))).toBe('critical');
    });
  });
});

// ─── computeActionRequiredCount ──────────────────────────────────────────────

describe('computeActionRequiredCount', () => {
  it('should return 0 when everything is good', () => {
    expect(computeActionRequiredCount(makeInput())).toBe(0);
  });

  it('should add 1 for committee requirement failure', () => {
    const input = makeInput({ committee: { meetsQuarterlyRequirement: false } });
    expect(computeActionRequiredCount(input)).toBe(1);
  });

  it('should add 1 for guideline items not fulfilled', () => {
    const input = makeInput({ guideline: { allItemsFulfilled: false } });
    expect(computeActionRequiredCount(input)).toBe(1);
  });

  it('should add 1 for training requirement failure', () => {
    const input = makeInput({ training: { meetsBiannualRequirement: false } });
    expect(computeActionRequiredCount(input)).toBe(1);
  });

  it('should add pendingApproval count directly', () => {
    const input = makeInput({ restraint: { pendingApproval: 3, incompleteRequirements: 0 } });
    expect(computeActionRequiredCount(input)).toBe(3);
  });

  it('should add incompleteRequirements count directly', () => {
    const input = makeInput({ restraint: { pendingApproval: 0, incompleteRequirements: 2 } });
    expect(computeActionRequiredCount(input)).toBe(2);
  });

  it('should add pendingFollowUp count directly', () => {
    const input = makeInput({ incident: { pendingFollowUp: 4 } });
    expect(computeActionRequiredCount(input)).toBe(4);
  });

  it('should sum all counts when multiple conditions are present', () => {
    // committee(1) + guideline(1) + training(1) + pendingApproval(2) + incompleteReq(1) + followUp(3)
    const input: SafetyLevelInput = {
      incident: { pendingFollowUp: 3 },
      restraint: { pendingApproval: 2, incompleteRequirements: 1 },
      committee: { meetsQuarterlyRequirement: false },
      guideline: { allItemsFulfilled: false },
      training: { meetsBiannualRequirement: false },
    };
    expect(computeActionRequiredCount(input)).toBe(9);
  });
});
