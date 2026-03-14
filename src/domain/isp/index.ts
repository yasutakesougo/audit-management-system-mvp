/**
 * ISP 三層モデル — barrel export
 *
 * schema.ts が実装上の Primary API。
 * types.ts は制度モデル（ADR-005 参照用）として提供。
 *
 * 名前衝突（IndividualSupportPlan 等）があるため、
 * types.ts は個別 import で利用する:
 *   import type { IndividualSupportPlan } from '@/domain/isp/types';
 *
 * @example
 * ```ts
 * import { ispFormSchema, isValidIspTransition } from '@/domain/isp';
 * ```
 */

// ─────────────────────────────────────────────
// Primary API: Zod schemas + runtime types + utilities
// ─────────────────────────────────────────────
export * from './schema';

// ─────────────────────────────────────────────
// Repository Ports + Input types
// ─────────────────────────────────────────────
export * from './port';

// ─────────────────────────────────────────────
// Institutional model (ADR-005 conceptual types)
// Re-export non-conflicting types.
// For conflicting names, import directly from '@/domain/isp/types'.
// ─────────────────────────────────────────────
export type {
  // 共通
  AuditTrail,
  VersionHistoryEntry,
  // 第1層 ISP — 制度モデルの証跡型
  ConsentRecord,
  DeliveryRecord,
  MonitoringRecord,
  GoalAchievementRecord,
  MeetingRecord,
  // 第2層 — 三層型 (ibdTypes を制度モデルで補完)
  SupportPlanSheetThreeLayer,
  // 第3層 — 実施記録の制度モデル版
  ProcedureExecutionRecord,
  // 統合ビュー
  ThreeLayerTraceabilityView,
  ISPToRecordPath,
  RecordToISPPath,
} from './types';

// 制度モデルの ISP ステータス（schema の IspStatus とは異なる粒度）
export type {
  ISPStatus,
  SupportPlanSheetStatus,
} from './types';

// 制度モデルの定数・関数（schema 側と名前が異なるためそのまま export 可能）
export {
  ISP_STATUS_LABELS,
  ISP_STATUS_TRANSITIONS,
  SUPPORT_PLAN_SHEET_STATUS_LABELS,
  SUPPORT_PLAN_SHEET_TRANSITIONS,
  isValidISPTransition,
  isValidSupportPlanSheetTransition,
} from './types';

// ─────────────────────────────────────────────
// 支援計画シート再評価（ISP MonitoringRecord とは別管理）
// ─────────────────────────────────────────────
export * from './planningSheetReassessment';
