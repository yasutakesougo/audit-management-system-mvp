/**
 * Monitoring → Planning Bridge Type Contract
 * 
 * L1 (モニタリング) で得られた洞察を L2 (計画シート) の候補として扱うための契約。
 */

export type PlanningCandidateType = 
  | 'observation'      // 行動観察
  | 'hypothesis'       // 背景仮説
  | 'environmental'    // 環境調整
  | 'strategy'         // 関わり方
  | 'risk';            // リスク・留意点

export interface BridgeProvenance {
  /** 出典元 ID (モニタリングIDなど) */
  sourceId: string;
  /** 出典の種類 */
  sourceType: 'monitoring' | 'pdca' | 'daily';
  /** 観察・分析日 (ISO 8601) */
  observedAt: string;
  /** 記録者 ID */
  authorId?: number;
}

/** 支援計画への提案・候補 */
export interface PlanningCandidate {
  /** 候補 ID (UUID等) */
  id: string;
  /** 分類 */
  type: PlanningCandidateType;
  /** 提案内容・サマリ */
  content: string;
  /** 出典情報 */
  provenance: BridgeProvenance;
  /** 推奨されるアクション */
  suggestedAction: 'add' | 'update' | 'refine';
  /** 確信度 (0.0 - 1.0) */
  confidence: number;
  /** 理由・根拠の説明 */
  reason: string;
}

/** 
 * 再評価シグナル
 * モニタリング結果から計画の見直しが必要かどうかを判定する指標。
 */
export interface ReassessmentSignal {
  /** 即時の見直しが必要か */
  isRequired: boolean;
  /** 根拠となる理由 */
  reason: string;
  /** 優先度 */
  priority: 'low' | 'medium' | 'high';
  /** 関連する PDCA フェーズ */
  triggerPhase: string;
}

/** 
 * Monitoring → Planning Bridge 結果
 */
export interface MonitoringToPlanningBridge {
  /** 対象の計画シート ID */
  planningSheetId: string;
  /** 生成された候補リスト */
  candidates: PlanningCandidate[];
  /** 再評価の判断材料 */
  reassessmentSignal: ReassessmentSignal;
}

/**
 * 外部接続用サマリ
 * Today Hub や Dashboard で「どの程度の提案があるか」を把握するための型。
 */
export interface BridgeSummary {
  candidateCount: number;
  highPrioritySignal: boolean;
  latestObservationAt: string | null;
}
