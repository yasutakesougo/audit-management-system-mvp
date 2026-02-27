// 国保連プリバリデーション — バレルエクスポート

// Types
export type {
  DailyProvisionEntry,
  DerivedProvisionEntry,
  KokuhorenUserProfile,
  MonthlyProvisionInput,
  TimeCode,
  ValidationIssue,
  ValidationLevel,
  ValidationResult,
} from './types';

// Catalog
export { ABSENT_SUPPORT_MONTHLY_LIMIT, getRule, getRuleMessage, RULE_CATALOG } from './catalog';
export type { RuleDef, RuleId } from './catalog';

// Derive
export {
  calcDurationMinutes,
  deriveProvisionEntry,
  durationToTimeCode,
  hasDataOnNonProvided,
  hhmmToMinutes,
  isDurationExtreme,
} from './derive';

// Validate
export { validateMonthly } from './validateMonthly';
