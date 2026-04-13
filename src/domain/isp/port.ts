/**
 * ISP 三層モデル — Repository Port インターフェース
 *
 * UI が必要とする操作だけを定義する。
 * 実装（SharePoint adapter 等）はこのポートに準拠する。
 *
 * @see docs/adr/ADR-005-isp-three-layer-separation.md
 * @see src/domain/isp/schema.ts
 */

import type {
  IndividualSupportPlan,
  IspFormValues,
  SupportPlanningSheet,
  PlanningSheetFormValues,
  SupportProcedureRecord,
  ProcedureRecordFormValues,
  IspListItem,
  PlanningSheetListItem,
  ProcedureRecordListItem,
  RegulatoryBasisSnapshot,
  PlanningIntake,
  PlanningAssessment,
  PlanningDesign,
} from './schema';
import type { BehaviorMonitoringRecord } from './behaviorMonitoring';
import type { PlanningSheetReassessment } from './planningSheetReassessment';

import type { UserSnapshot } from '@/domain/user/userRelation';

// ─────────────────────────────────────────────
// Input 型（Create / Update 分離）
// ─────────────────────────────────────────────

/** ISP のシステム付与項目（フォーム外） */
interface IspSystemFields {
  /** 作成時点の利用者マスタ属性を凍結保存 */
  userSnapshot?: UserSnapshot;
}

/** ISP 新規作成入力（id, version, timestamps は自動付与） */
export type IspCreateInput = IspFormValues & IspSystemFields;

/** ISP 更新入力（部分更新可） */
export type IspUpdateInput = Partial<IspFormValues> & IspSystemFields;

/** 支援計画シートのシステム付与項目（フォーム外） */
interface PlanningSheetSystemFields {
  /** 対象者判定スナップショット（作成時点の利用者情報を凍結） */
  regulatoryBasisSnapshot?: RegulatoryBasisSnapshot;
  /** インテーク（情報収集）セクション */
  intake?: PlanningIntake;
  /** アセスメントセクション */
  assessment?: PlanningAssessment;
  /** プランニング（支援設計）セクション */
  planning?: PlanningDesign;
}

/** 支援計画シート新規作成入力 */
export type PlanningSheetCreateInput = PlanningSheetFormValues & PlanningSheetSystemFields;

/** 支援計画シート更新入力（部分更新可） */
export type PlanningSheetUpdateInput = Partial<PlanningSheetFormValues> & PlanningSheetSystemFields;

/** 支援手順記録新規作成入力 */
export type ProcedureRecordCreateInput = ProcedureRecordFormValues;

/** 支援手順記録更新入力（部分更新可） */
export type ProcedureRecordUpdateInput = Partial<ProcedureRecordFormValues>;

// ─────────────────────────────────────────────
// 第1層: ISP Repository Port
// ─────────────────────────────────────────────

export interface IspRepository {
  /** ISP を ID で取得 */
  getById(id: string): Promise<IndividualSupportPlan | null>;
  /** 利用者に紐づく ISP 一覧 */
  listByUser(userId: string): Promise<IspListItem[]>;
  /** 利用者に紐づく ISP 一覧（フル） */
  listFullByUser(userId: string): Promise<IndividualSupportPlan[]>;
  /** 利用者の現行 ISP を取得（isCurrent: true） */
  getCurrentByUser(userId: string): Promise<IndividualSupportPlan | null>;
  /** 全利用者の現行 ISP を一括取得（isCurrent: true） */
  listAllCurrent(): Promise<IndividualSupportPlan[]>;
  /** ISP 新規作成 */
  create(input: IspCreateInput): Promise<IndividualSupportPlan>;
  /** ISP 更新 */
  update(id: string, input: IspUpdateInput): Promise<IndividualSupportPlan>;
}

// ─────────────────────────────────────────────
// 第2層: PlanningSheet Repository Port
// ─────────────────────────────────────────────

export interface PlanningSheetRepository {
  /** 支援計画シートを ID で取得 */
  getById(id: string): Promise<SupportPlanningSheet | null>;
  /** ISP に紐づく支援計画シート一覧 */
  listByIsp(ispId: string): Promise<PlanningSheetListItem[]>;
  /** 利用者の現行支援計画シート一覧（isCurrent: true） */
  listCurrentByUser(userId: string): Promise<PlanningSheetListItem[]>;
  /** 支援計画シート新規作成 */
  create(input: PlanningSheetCreateInput): Promise<SupportPlanningSheet>;
  /** 支援計画シート更新 */
  update(id: string, input: PlanningSheetUpdateInput): Promise<SupportPlanningSheet>;
}

// ─────────────────────────────────────────────
// 第3層: ProcedureRecord Repository Port
// ─────────────────────────────────────────────

export interface ProcedureRecordRepository {
  /** 支援手順記録を ID で取得 */
  getById(id: string): Promise<SupportProcedureRecord | null>;
  /** 支援計画シートに紐づく記録一覧 */
  listByPlanningSheet(planningSheetId: string): Promise<ProcedureRecordListItem[]>;
  /** 利用者 × 日付 の記録一覧 */
  listByUserAndDate(userId: string, recordDate: string): Promise<ProcedureRecordListItem[]>;
  /** 支援手順記録新規作成 */
  create(input: ProcedureRecordCreateInput): Promise<SupportProcedureRecord>;
  /** 支援手順記録更新 */
  update(id: string, input: ProcedureRecordUpdateInput): Promise<SupportProcedureRecord>;
}

// ─────────────────────────────────────────────
// 第2層補助: BehaviorMonitoring Repository Port
// ─────────────────────────────────────────────

export interface BehaviorMonitoringRepository {
  /** 支援計画シート × 利用者に紐づく行動モニタリング記録一覧 */
  findByPlanningSheetId(params: {
    planningSheetId: string;
    userId: string;
  }): Promise<BehaviorMonitoringRecord[]>;
}

// ─────────────────────────────────────────────
// 第2層補助: PlanningSheetReassessment Repository Port
// ─────────────────────────────────────────────

export interface PlanningSheetReassessmentRepository {
  /** 支援計画シートに紐づく再評価一覧 */
  findByPlanningSheetId(params: {
    planningSheetId: string;
  }): Promise<PlanningSheetReassessment[]>;
}
