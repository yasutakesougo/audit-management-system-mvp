import { DriftType } from '../drift/domain/driftLogic';

/**
 * ガバナンス・アクション
 */
export type GovernanceAction = 
  | 'auto_heal'   // サイレント修復（信頼済みの修復）
  | 'propose'     // 管理者への提案（UIにボタン表示）
  | 'notify'      // 通知のみ（重大な警告）
  | 'block'       // 実行ブロック（リスクが高すぎる項目）
  | 'none';       // アクション不要

/**
 * 自治レベル設定 (Autonomy Level)
 * F: 部分的自律 (提案ベース)
 * G: 高度自律 (信頼済み項目のサイレント修復)
 */
export type AutonomyLevel = 'F' | 'G';

export interface GovernanceDecision {
  action: GovernanceAction;
  confidence: number; // 0.0 - 1.0 (修復の確信度)
  riskLevel: 'low' | 'medium' | 'high';
  reason: string;
}

/**
 * 信頼済み「サイレント修復」対象 (Trust Anchor)
 */
const TRUST_ANCHOR_DRIFTS: DriftType[] = [
  'case_mismatch',
  'fuzzy_match'
];

/**
 * 自治ガバナンス・エンジン (Pure Function)
 * 
 * 検知された異常に対して、自律レベルに応じたアクションを決定する。
 */
export const decideGovernanceAction = (
  driftType: DriftType,
  level: AutonomyLevel = 'F',
  isEssential: boolean = false
): GovernanceDecision => {
  // 1. リスク評価
  const riskLevel = isEssential ? 'high' : (driftType === 'fallback' ? 'medium' : 'low');

  // 2. 確信度評価 (DriftType 依存)
  let confidence = 0.5;
  if (driftType === 'case_mismatch' || driftType === 'fuzzy_match') confidence = 0.95;
  if (driftType === 'suffix_mismatch') confidence = 0.8;
  if (driftType === 'fallback') confidence = 0.6;

  // 3. アクション決定ロジック
  
  // レベル G (高度自律) かつ 低リスク・高確信度の場合はサイレント修復
  if (level === 'G' && TRUST_ANCHOR_DRIFTS.includes(driftType) && riskLevel === 'low') {
    return {
      action: 'auto_heal',
      confidence,
      riskLevel,
      reason: `Trust Anchor に該当する低リスクな不整合（${driftType}）のため、自動修復を適用します。`
    };
  }

  // 必須項目だが修正が必要な場合は high risk notify
  if (isEssential && driftType !== 'unknown') {
    return {
      action: 'notify',
      confidence,
      riskLevel: 'high',
      reason: '必須項目のスキーマ異常を検知しました。手動での確認が必要です。'
    };
  }

  // それ以外は提案ベース (Propose)
  if (confidence >= 0.8) {
    return {
      action: 'propose',
      confidence,
      riskLevel,
      reason: '確信度の高い不整合を検知しました。手動修復を推奨します。'
    };
  }

  return {
    action: 'notify',
    confidence,
    riskLevel,
    reason: '原因不明または低確信度の不整合を検知しました。詳細ログを確認してください。'
  };
};
