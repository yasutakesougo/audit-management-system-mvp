/**
 * SupportChangeProposal — 支援方針の変更提案
 *
 * Phase 6 の中核型。Iceberg PDCA の ACT フェーズから生成され、
 * MonitoringTab でレビュー・採否判断される。
 *
 * @module features/support-plan-guide/domain/proposalTypes
 */

// ── Proposal Source ──

/** 提案の生成元 — Phase 6 初期は 'iceberg' のみ */
export type ProposalSource = 'iceberg';
// 将来拡張: 'iceberg' | 'daily' | 'monitoring'

// ── Evidence Reference ──

/** 元データへの参照 */
export interface EvidenceRef {
  /** 参照先の種別 */
  type: 'pdca-item';
  /** 参照先ID（IcebergPdcaItem.id） */
  itemId: string;
  /** PDCA フェーズ（常に 'ACT'） */
  phase: 'ACT';
}

// ── Proposal Status ──

/** 提案の状態 */
export type ProposalStatus = 'proposed' | 'accepted' | 'deferred' | 'rejected';

// ── Core Type ──

/** 支援方針の変更提案 */
export interface SupportChangeProposal {
  /** 一意ID */
  id: string;
  /** 対象利用者ID */
  userId: string;
  /** 提案の生成元 */
  source: ProposalSource;
  /** 提案タイトル（ACT item の title から） */
  title: string;
  /** 変更理由（PDCA の summary + 分析根拠） */
  rationale: string;
  /** 推奨アクション */
  recommendedAction: string;
  /** 元データへの参照 */
  evidenceRef: EvidenceRef;
  /** 現在の状態 */
  status: ProposalStatus;
  /** 生成日時 */
  createdAt: string;
  /** レビュー日時（status 変更時） */
  reviewedAt?: string;
  /** レビューコメント（任意） */
  reviewNote?: string;
}

// ── Plan Reflection Trace ──

/** 採用された提案が支援計画に反映された記録（監査証跡） */
export interface PlanReflectionTrace {
  /** 一意ID */
  id: string;
  /** 元の提案ID */
  proposalId: string;
  /** 対象利用者ID */
  userId: string;
  /** 提案タイトル（スナップショット） */
  proposalTitle: string;
  /** 反映先フィールド */
  targetField: 'monitoringPlan';
  // 将来拡張: 'monitoringPlan' | 'supportGoal' | 'serviceContent'
  /** 反映日時 */
  reflectedAt: string;
  /** Evidence 追跡チェーン */
  evidenceChain: {
    /** 元の PDCA item ID */
    pdcaItemId: string;
    /** 提案の生成元 */
    source: ProposalSource;
    /** 採用日時 */
    acceptedAt: string;
  };
}
