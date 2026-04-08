import { describe, expect, it } from 'vitest';
import { decideGovernanceAction } from '../governanceEngine';

describe('GovernanceEngine - Phase F/G Policy Contract', () => {
  describe('Level F (Partial Autonomy / Proposal Based)', () => {
    it('proposes remediation for high-confidence drifts (case_mismatch)', () => {
      const decision = decideGovernanceAction('case_mismatch', 'F');
      expect(decision.action).toBe('propose');
      expect(decision.confidence).toBeGreaterThanOrEqual(0.9);
      expect(decision.riskLevel).toBe('low');
    });

    it('notifies without proposing for low-confidence drifts (unknown)', () => {
      const decision = decideGovernanceAction('unknown', 'F');
      expect(decision.action).toBe('notify');
      expect(decision.riskLevel).toBe('low');
    });

    it('flags high risk when essential fields are drifted', () => {
      const decision = decideGovernanceAction('suffix_mismatch', 'F', true);
      expect(decision.action).toBe('notify');
      expect(decision.riskLevel).toBe('high');
    });

    it('stays as notify for essential fields even with high confidence (case_mismatch)', () => {
      // 必須項目の場合は、確実性が高くても提案(propose)ではなく通知(notify)に倒すことで安全を優先
      const decision = decideGovernanceAction('case_mismatch', 'F', true);
      expect(decision.action).toBe('notify');
      expect(decision.riskLevel).toBe('high');
    });
  });

  describe('Level G (High Autonomy / Silent Repair)', () => {
    it('executes auto_heal for Trust Anchor items (case_mismatch)', () => {
      const decision = decideGovernanceAction('case_mismatch', 'G');
      expect(decision.action).toBe('auto_heal');
      expect(decision.riskLevel).toBe('low');
    });

    it('reverts to propose for high-risk items even in Level G', () => {
      // isEssential = true should block silent repair
      const decision = decideGovernanceAction('case_mismatch', 'G', true);
      expect(decision.action).not.toBe('auto_heal');
      expect(decision.riskLevel).toBe('high');
    });

    it('proposes manual action for suffix_mismatch in Level G', () => {
      // suffix_mismatch is NOT in Trust Anchor
      const decision = decideGovernanceAction('suffix_mismatch', 'G');
      expect(decision.action).toBe('propose');
    });

    it('allows auto_heal for optional fields with case_mismatch in Level G', () => {
      const decision = decideGovernanceAction('case_mismatch', 'G', false); // isEssential = false
      expect(decision.action).toBe('auto_heal');
    });
  });
});
