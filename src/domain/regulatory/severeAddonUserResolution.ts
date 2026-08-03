import { resolveBehaviorScore } from './behaviorScoreResolution';

export type SupportLevelResolution =
  | { status: 'valid'; value: 4 | 5 | 6 }
  | { status: 'ineligible'; value: 1 | 2 | 3 }
  | { status: 'missing'; reason: 'support-level-missing' }
  | { status: 'invalid'; reason: 'support-level-invalid' };

export type SevereAddonIndeterminateReason =
  | 'support-level-missing'
  | 'support-level-invalid'
  | 'behavior-score-missing'
  | 'behavior-score-invalid';

export type SevereAddonUserResolution =
  | { status: 'valid'; supportLevel: 4 | 5 | 6; behaviorScore: number }
  | { status: 'ineligible'; supportLevel: 1 | 2 | 3 }
  | { status: 'indeterminate'; reason: SevereAddonIndeterminateReason };

export const SEVERE_ADDON_INDETERMINATE_REASON_LABELS: Record<SevereAddonIndeterminateReason, string> = {
  'support-level-missing': '障害支援区分が未入力のため、判定できません。',
  'support-level-invalid': '障害支援区分が不正なため、判定できません。',
  'behavior-score-missing': '行動関連点数が未入力のため、判定できません。',
  'behavior-score-invalid': '行動関連点数が不正なため、判定できません。',
};

export function resolveSupportLevel(value: unknown): SupportLevelResolution {
  if (value === null || value === undefined) {
    return { status: 'missing', reason: 'support-level-missing' };
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return { status: 'missing', reason: 'support-level-missing' };
    }
    if (!/^[1-6]$/.test(trimmed)) {
      return { status: 'invalid', reason: 'support-level-invalid' };
    }
    return resolveNumericSupportLevel(Number(trimmed));
  }

  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return { status: 'invalid', reason: 'support-level-invalid' };
  }

  return resolveNumericSupportLevel(value);
}

function resolveNumericSupportLevel(value: number): SupportLevelResolution {
  if (value < 1 || value > 6) {
    return { status: 'invalid', reason: 'support-level-invalid' };
  }
  if (value <= 3) {
    return { status: 'ineligible', value: value as 1 | 2 | 3 };
  }
  return { status: 'valid', value: value as 4 | 5 | 6 };
}

export function resolveSevereAddonUserResolution(input: {
  supportLevel: unknown;
  behaviorScore: unknown;
}): SevereAddonUserResolution {
  const supportLevel = resolveSupportLevel(input.supportLevel);
  if (supportLevel.status === 'ineligible') {
    return { status: 'ineligible', supportLevel: supportLevel.value };
  }
  if (supportLevel.status !== 'valid') {
    return { status: 'indeterminate', reason: supportLevel.reason };
  }

  const behaviorScore = resolveBehaviorScore(input.behaviorScore as number | null | undefined);
  if (behaviorScore.status === 'indeterminate' && behaviorScore.reason === 'missing') {
    return { status: 'indeterminate', reason: 'behavior-score-missing' };
  }
  if (behaviorScore.status !== 'valid') {
    return { status: 'indeterminate', reason: 'behavior-score-invalid' };
  }

  return {
    status: 'valid',
    supportLevel: supportLevel.value,
    behaviorScore: behaviorScore.value,
  };
}
