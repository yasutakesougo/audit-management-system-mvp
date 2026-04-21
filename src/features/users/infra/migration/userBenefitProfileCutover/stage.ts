/**
 * Lot1B PR #E — rename-migrate cutover stage flag.
 *
 * 注入点は `src/config/featureFlags.ts` に統一。本モジュールは
 * 既存インポータ向けの薄いラッパ / 順序判定ヘルパのみを提供する。
 *
 * Rollback 指針:
 *   - いつでも stage を下げれば read は legacy fallback に戻る（ROLLBACK SAFE）
 *   - WRITE_CUTOVER まで進めた後でも READ_FALLBACK or DUAL_WRITE に戻せる
 *     （legacy 列を残置している限り）
 */

import {
  ENV_KEY_USER_BENEFIT_PROFILE_CUTOVER_STAGE,
  LOCAL_STORAGE_KEY_USER_BENEFIT_PROFILE_CUTOVER_STAGE,
  resolveUserBenefitProfileCutoverStage as resolveFromFeatureFlags,
  USER_BENEFIT_PROFILE_CUTOVER_STAGES,
  type UserBenefitProfileCutoverStage,
} from '../../../../../config/featureFlags';

export const CutoverStage = {
  PRE_MIGRATION: 'PRE_MIGRATION',
  DUAL_WRITE: 'DUAL_WRITE',
  BACKFILL_IN_PROGRESS: 'BACKFILL_IN_PROGRESS',
  READ_CUTOVER: 'READ_CUTOVER',
  WRITE_CUTOVER: 'WRITE_CUTOVER',
} as const satisfies Record<UserBenefitProfileCutoverStage, UserBenefitProfileCutoverStage>;

export type CutoverStageValue = UserBenefitProfileCutoverStage;

export {
  ENV_KEY_USER_BENEFIT_PROFILE_CUTOVER_STAGE,
  LOCAL_STORAGE_KEY_USER_BENEFIT_PROFILE_CUTOVER_STAGE,
};

export const resolveUserBenefitProfileCutoverStage = resolveFromFeatureFlags;

export const isAtLeastStage = (current: CutoverStageValue, target: CutoverStageValue): boolean => {
  const a = USER_BENEFIT_PROFILE_CUTOVER_STAGES.indexOf(current);
  const b = USER_BENEFIT_PROFILE_CUTOVER_STAGES.indexOf(target);
  return a >= 0 && b >= 0 && a >= b;
};
