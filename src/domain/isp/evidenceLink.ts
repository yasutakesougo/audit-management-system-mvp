/**
 * EvidenceLink — 支援計画の戦略セクションに紐づくABC/PDCA根拠
 *
 * 各支援戦略（先行事象・教授・後続事象）がどのABC記録やPDCA項目を
 * 根拠として採用したかを記録する。
 *
 * @module domain/isp/evidenceLink
 */

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/** 根拠の種別 */
export type EvidenceLinkType = 'abc' | 'pdca';

/** 根拠リンク1件 */
export interface EvidenceLink {
  /** 根拠の種別 */
  type: EvidenceLinkType;
  /** 参照先 ID（ABC record ID or PDCA item ID） */
  referenceId: string;
  /** 表示用ラベル（保存時のスナップショット） */
  label: string;
  /** 紐づけ日時 */
  linkedAt: string;
}

/** 支援設計セクションごとの根拠リンク集 */
export type StrategyEvidenceKey =
  | 'antecedentStrategies'     // 先行事象戦略（≈ 予防的支援）
  | 'teachingStrategies'       // 教授戦略（≈ 代替行動）
  | 'consequenceStrategies';   // 後続事象戦略（≈ 危機対応）

/**
 * 支援設計に紐づく根拠マップ
 *
 * key = 戦略セクション名
 * value = そのセクションに採用された根拠リンク一覧
 */
export type EvidenceLinkMap = Record<StrategyEvidenceKey, EvidenceLink[]>;

/** 空の根拠マップを生成 */
export function createEmptyEvidenceLinkMap(): EvidenceLinkMap {
  return {
    antecedentStrategies: [],
    teachingStrategies: [],
    consequenceStrategies: [],
  };
}
