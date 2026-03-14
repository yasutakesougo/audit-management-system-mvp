/**
 * 制度判定ドメイン — barrel export
 *
 * Users / Staff マスタの制度判定属性を一元化して提供。
 *
 * @example
 * ```ts
 * import {
 *   userRegulatoryProfileSchema,
 *   isSevereBehaviorSupportCandidate,
 *   staffQualificationProfileSchema,
 *   resolveHighestQualification,
 *   meetsAuthoringRequirement,
 *   checkUserEligibility,
 *   evaluateSevereDisabilityAddOn,
 *   createBasicTrainingRatioSnapshot,
 * } from '@/domain/regulatory';
 * ```
 */
export * from './userRegulatoryProfile';
export * from './staffQualificationProfile';
export * from './auditChecks';
export * from './severeDisabilityAddon';
export * from './basicTrainingRatio';
export * from './severeAddonFindings';
export * from './findingToHandoff';
export * from './reassessmentMapBuilder';
export * from './weeklyObservationChecker';
export * from './assignmentQualificationChecker';
export * from './auditCheckInputBuilder';
