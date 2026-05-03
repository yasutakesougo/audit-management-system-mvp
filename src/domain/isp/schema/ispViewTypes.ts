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

// ─────────────────────────────────────────────
// インサイト・差分分析用型
// ─────────────────────────────────────────────

/** 差分インサイトの個別の変更点 */
export interface DifferenceChange {
  /** 項目名 (例: "行動", "要因") */
  label: string;
  /** 内容 (例: "追加: 暴言") */
  value: string;
  /** 優先度/重要度 */
  level: 'high' | 'medium' | 'low';
}

/** 氷山分析と支援計画の差分インサイト */
export interface DifferenceInsight {
  /** 検知された変更点リスト */
  changes: DifferenceChange[];
  /** 比較対象とした Iceberg セッション ID */
  sourceSessionId: string;
}

/** Iceberg 分析の要約（計画反映チェック用） */
export interface IcebergSummary {
  /** セッション ID */
  sessionId: string;
  /** 更新日時 */
  updatedAt: string;
  /** 主要対象行動（最も新しい behavior ノード） */
  primaryBehavior: string;
  /** 主要な要因（信頼度の高いリンクの sourceNode） */
  primaryFactor: string;
}
