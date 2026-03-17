/**
 * ISP 三層モデル — 合成ビュー型・編集状態型
 *
 * ISP・支援計画シート・実施記録を束ねた合成表示用型と
 * 各編集画面の状態型を定義する。
 *
 * @see docs/adr/ADR-005-isp-three-layer-separation.md
 */

import type { IndividualSupportPlan, IspFormValues } from './ispBaseSchema';
import type { SupportPlanningSheet, PlanningSheetFormValues, PlanningSheetListItem } from './ispPlanningSheetSchema';
import type { SupportProcedureRecord, ProcedureRecordFormValues } from './ispProcedureRecordSchema';

// ─────────────────────────────────────────────
// 合成ビュー型
// ─────────────────────────────────────────────

/** ISP → 支援計画シート → 実施記録を束ねた合成表示用型 */
export interface SupportPlanBundle {
  isp: IndividualSupportPlan;
  planningSheets: SupportPlanningSheet[];
  recentProcedureRecords: SupportProcedureRecord[];
  /** 支援計画シートごとの Iceberg 分析件数（planningSheetId → count） */
  icebergCountBySheet?: Record<string, number>;
  /** 直近のモニタリング結果 */
  latestMonitoring?: { date: string; planChangeRequired: boolean } | null;
  /** 支援計画シートごとの実施記録件数（planningSheetId → count） */
  procedureRecordCountBySheet?: Record<string, number>;
  /** 支援計画シート総数 */
  planningSheetCount?: number;
  /** 実施記録の直近日付 */
  lastProcedureRecordDate?: string | null;
  /** 支援計画シート一覧（軽量版、カード表示用） */
  planningSheetItems?: PlanningSheetListItem[];
}

// ─────────────────────────────────────────────
// 編集状態用型
// ─────────────────────────────────────────────

/** ISP 編集画面の状態型 */
export interface IspEditorState {
  draft: IspFormValues;
  isDirty: boolean;
  validationErrors: string[];
}

/** 支援計画シート編集画面の状態型 */
export interface PlanningSheetEditorState {
  draft: PlanningSheetFormValues;
  linkedIsp?: IndividualSupportPlan;
  isDirty: boolean;
  validationErrors: string[];
}

/** 支援手順記録入力画面の状態型 */
export interface ProcedureRecordEntryState {
  draft: ProcedureRecordFormValues;
  linkedPlanningSheet?: SupportPlanningSheet;
  linkedIsp?: IndividualSupportPlan;
  isDirty: boolean;
  validationErrors: string[];
}
