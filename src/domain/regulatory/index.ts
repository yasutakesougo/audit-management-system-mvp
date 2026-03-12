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
 * } from '@/domain/regulatory';
 * ```
 */
export * from './userRegulatoryProfile';
export * from './staffQualificationProfile';
export * from './auditChecks';
