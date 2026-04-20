import { describe, it, expect } from 'vitest';
import { generateRemediationActions } from '../selfHealingActionRules';
import { SelfHealingAggregate } from '../selfHealingNormalization';

describe('selfHealingActionRules', () => {
  it('should generate notice for 3 successes', () => {
    const aggs: SelfHealingAggregate[] = [{
      resourceKey: 'ListA',
      successCount: 3,
      skipCount: 0,
      failCount: 0,
      repeatedSuccessCount: 3,
      repeatedSkipCount: 0,
      lastOutcome: 'added',
      isFlappingCandidate: true
    }];

    const actions = generateRemediationActions(aggs);
    expect(actions).toHaveLength(1);
    expect(actions[0].level).toBe('notice');
    expect(actions[0].reasonCode).toBe('repeated_success');
  });

  it('should generate recommendation for 5 successes', () => {
    const aggs: SelfHealingAggregate[] = [{
      resourceKey: 'ListA',
      successCount: 5,
      skipCount: 0,
      failCount: 0,
      repeatedSuccessCount: 5,
      repeatedSkipCount: 0,
      lastOutcome: 'added',
      isFlappingCandidate: true
    }];

    const actions = generateRemediationActions(aggs);
    expect(actions[0].level).toBe('recommendation');
    expect(actions[0].reasonCode).toBe('persistent_remediation');
  });

  it('should generate escalation for 3 repeated skips', () => {
    const aggs: SelfHealingAggregate[] = [{
      resourceKey: 'ListA',
      successCount: 0,
      skipCount: 3,
      failCount: 0,
      repeatedSuccessCount: 0,
      repeatedSkipCount: 3,
      lastOutcome: 'skipped_limit',
      isFlappingCandidate: true
    }];

    const actions = generateRemediationActions(aggs);
    expect(actions[0].level).toBe('escalation');
    expect(actions[0].reasonCode).toBe('repeated_skip_limit');
  });

  it('should prioritize escalation over recommendation', () => {
    const aggs: SelfHealingAggregate[] = [{
      resourceKey: 'ListA',
      successCount: 5, // Recommendation 条件
      skipCount: 3,
      failCount: 0,
      repeatedSuccessCount: 5,
      repeatedSkipCount: 3, // Escalation 条件 
      lastOutcome: 'skipped_limit',
      isFlappingCandidate: true
    }];

    const actions = generateRemediationActions(aggs);
    expect(actions).toHaveLength(1);
    expect(actions[0].level).toBe('escalation');
  });

  it('should return no action for counts below threshold', () => {
    const aggs: SelfHealingAggregate[] = [{
      resourceKey: 'ListA',
      successCount: 2,
      skipCount: 2,
      failCount: 0,
      repeatedSuccessCount: 2,
      repeatedSkipCount: 2,
      lastOutcome: 'added',
      isFlappingCandidate: false
    }];

    const actions = generateRemediationActions(aggs);
    expect(actions).toHaveLength(0);
  });
});
