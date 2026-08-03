export type BehaviorScoreIndeterminateReason =
  | 'missing'
  | 'invalid-type'
  | 'not-finite'
  | 'negative';

export type BehaviorScoreResolution =
  | { status: 'valid'; value: number }
  | { status: 'indeterminate'; reason: BehaviorScoreIndeterminateReason };

export function resolveBehaviorScore(value: unknown): BehaviorScoreResolution {
  if (value === null || value === undefined) {
    return { status: 'indeterminate', reason: 'missing' };
  }
  if (typeof value !== 'number') {
    return { status: 'indeterminate', reason: 'invalid-type' };
  }
  if (!Number.isFinite(value)) {
    return { status: 'indeterminate', reason: 'not-finite' };
  }
  if (value < 0) {
    return { status: 'indeterminate', reason: 'negative' };
  }
  return { status: 'valid', value };
}
