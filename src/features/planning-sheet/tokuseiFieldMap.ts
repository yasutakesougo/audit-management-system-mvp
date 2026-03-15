/**
 * tokuseiFieldMap.ts — 特性アンケート → 支援計画シート マッピング辞書
 *
 * ロジックから分離された宣言的ルール定義。
 * 項目追加時はこの辞書を追記するだけで対応できる。
 *
 * @module
 */
import type { BridgeConfidence, TokuseiSourceNormalized } from './tokuseiToPlanningBridge';

// ---------------------------------------------------------------------------
// Section / Target 定数
// ---------------------------------------------------------------------------

/** 支援計画シートのセクション識別子 */
export type PlanningSection =
  | 'iceberg'      // §3 氷山分析
  | 'fba'          // §4 FBA（機能的行動評価）
  | 'prevention'   // §5 予防的支援
  | 'replacement'  // §6 代替行動
  | 'target'       // §2 対象行動
  | 'team';        // §10 チーム共有

/** マッピング先のフィールド名 */
export type PlanningTarget =
  | 'triggers'              // 氷山分析: トリガー
  | 'environmentFactors'    // 氷山分析: 環境要因
  | 'emotions'              // 氷山分析: 感情・心理
  | 'cognition'             // 氷山分析: 認知・理解
  | 'behaviorFunctionDetail' // FBA: 機能分析
  | 'environmentalAdjustment' // 予防的支援: 環境調整
  | 'visualSupport'         // 予防的支援: 見通し支援
  | 'reinforcementMethod'   // 代替行動: 強化方法
  | 'targetBehavior'        // 対象行動
  | 'behaviorSituation'     // 行動の発生場面
  | 'teamConsensusNote';    // チーム共有: 合意事項

// ---------------------------------------------------------------------------
// Field Map Entry
// ---------------------------------------------------------------------------

/** マッピング辞書の1エントリ */
export interface TokuseiFieldMapEntry {
  /** 変換先セクション */
  section: PlanningSection;
  /** 変換先フィールド */
  target: PlanningTarget;
  /** 自動入力時の信頼度 */
  confidence: BridgeConfidence;
  /** 出典ラベルに使う日本語名 */
  sourceLabel: string;
  /** 変換時のプレフィックス（省略可） */
  prefix?: string;
}

// ---------------------------------------------------------------------------
// Mapping Dictionary
// ---------------------------------------------------------------------------

/**
 * 特性アンケートの細分化フィールド名 → 支援計画シートへのマッピング定義。
 *
 * キーは `TokuseiSourceNormalized` のフィールド名と対応する。
 */
export const TOKUSEI_FIELD_MAP: Record<keyof TokuseiSourceNormalized, TokuseiFieldMapEntry> = {
  // ── 感覚（5種） → §3 氷山分析: 環境要因 ──
  hearing: {
    section: 'iceberg',
    target: 'environmentFactors',
    confidence: 'high',
    sourceLabel: '聴覚',
  },
  vision: {
    section: 'iceberg',
    target: 'environmentFactors',
    confidence: 'high',
    sourceLabel: '視覚',
  },
  touch: {
    section: 'iceberg',
    target: 'environmentFactors',
    confidence: 'high',
    sourceLabel: '触覚',
  },
  smell: {
    section: 'iceberg',
    target: 'environmentFactors',
    confidence: 'high',
    sourceLabel: '嗅覚',
  },
  taste: {
    section: 'iceberg',
    target: 'environmentFactors',
    confidence: 'high',
    sourceLabel: '味覚',
  },
  sensoryMultiSelect: {
    section: 'iceberg',
    target: 'environmentFactors',
    confidence: 'high',
    sourceLabel: '該当する感覚',
  },
  sensoryFreeText: {
    section: 'prevention',
    target: 'environmentalAdjustment',
    confidence: 'medium',
    sourceLabel: '感覚の詳細',
  },

  // ── こだわり → §3 氷山分析: トリガー / §5 予防 / §6 代替 ──
  difficultyWithChanges: {
    section: 'iceberg',
    target: 'triggers',
    confidence: 'high',
    sourceLabel: '変化への対応困難',
    prefix: '予定変更等',
  },
  fixedHabits: {
    section: 'iceberg',
    target: 'triggers',
    confidence: 'high',
    sourceLabel: '習慣への固執',
  },
  repetitiveBehaviors: {
    section: 'prevention',
    target: 'visualSupport',
    confidence: 'medium',
    sourceLabel: '繰り返し行動',
  },
  interestInParts: {
    section: 'replacement',
    target: 'reinforcementMethod',
    confidence: 'medium',
    sourceLabel: '物の一部への興味',
  },

  // ── 対人関係 → §3 氷山分析: 感情 / 認知 ──
  relationalDifficulties: {
    section: 'iceberg',
    target: 'emotions',
    confidence: 'medium',
    sourceLabel: '対人関係の難しさ',
  },
  situationalUnderstanding: {
    section: 'iceberg',
    target: 'cognition',
    confidence: 'high',
    sourceLabel: '状況理解の難しさ',
  },

  // ── コミュニケーション → §4 FBA ──
  comprehensionDifficulty: {
    section: 'fba',
    target: 'behaviorFunctionDetail',
    confidence: 'medium',
    sourceLabel: '理解の困難',
  },
  expressionDifficulty: {
    section: 'fba',
    target: 'behaviorFunctionDetail',
    confidence: 'medium',
    sourceLabel: '発信の困難',
  },
  interactionDifficulty: {
    section: 'fba',
    target: 'behaviorFunctionDetail',
    confidence: 'medium',
    sourceLabel: 'やり取りの困難',
  },

  // ── 行動 → §2 対象行動 ──
  behaviorMultiSelect: {
    section: 'target',
    target: 'behaviorSituation',
    confidence: 'medium',
    sourceLabel: '該当する行動',
  },
  behaviorEpisodes: {
    section: 'target',
    target: 'targetBehavior',
    confidence: 'low',
    sourceLabel: '行動エピソード',
  },

  // ── その他 ──
  strengths: {
    section: 'replacement',
    target: 'reinforcementMethod',
    confidence: 'high',
    sourceLabel: '得意なこと・強み',
  },
  notes: {
    section: 'team',
    target: 'teamConsensusNote',
    confidence: 'medium',
    sourceLabel: '特記事項',
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** 指定セクションに属するフィールドのリストを取得 */
export function getFieldsBySection(section: PlanningSection): (keyof TokuseiSourceNormalized)[] {
  return (Object.entries(TOKUSEI_FIELD_MAP) as [keyof TokuseiSourceNormalized, TokuseiFieldMapEntry][])
    .filter(([, entry]) => entry.section === section)
    .map(([key]) => key);
}

/** 指定信頼度以上のフィールドのリストを取得 */
export function getFieldsByMinConfidence(
  minConfidence: BridgeConfidence,
): (keyof TokuseiSourceNormalized)[] {
  const order: Record<BridgeConfidence, number> = { low: 0, medium: 1, high: 2 };
  const min = order[minConfidence];
  return (Object.entries(TOKUSEI_FIELD_MAP) as [keyof TokuseiSourceNormalized, TokuseiFieldMapEntry][])
    .filter(([, entry]) => order[entry.confidence] >= min)
    .map(([key]) => key);
}
