// ---------------------------------------------------------------------------
// ABCRecord — 統一行動記録ドメインモデル
//
// BehaviorObservation (features/daily) + ABCRecord (features/ibd) +
// ABCSelection (IndividualSupportManagementPage) を統合した
// One Source of Truth。
// ---------------------------------------------------------------------------

/** 行動強度 (1: 軽微 ～ 5: 非常に強い) */
export type BehaviorIntensity = 1 | 2 | 3 | 4 | 5;

/** 利用者の気分状態 */
export type BehaviorMood =
  | '良好'
  | '普通'
  | 'やや不安定'
  | '不安定'
  | '高揚'
  | '疲労';

/** ABA 4機能モデル */
export type BehaviorFunction =
  | 'demand'    // 要求
  | 'escape'    // 回避
  | 'attention' // 注目
  | 'sensory';  // 感覚

/** 行動のアウトカム */
export type BehaviorOutcome = 'increased' | 'decreased' | 'unchanged';

/**
 * ABCRecord — 統一行動記録
 *
 * 必須フィールド: id, userId, recordedAt, antecedent, behavior, consequence, intensity
 * 任意フィールド: 臨床分析 / スケジュール連動 / コンテキスト
 */
export interface ABCRecord {
  id: string;
  userId: string;

  // ── 時間 ──
  /** ISO 8601 記録日時 */
  recordedAt: string;
  /** 記録者ID (職員) */
  recordedBy?: string;

  // ── ABC ──
  /** 先行事象 (Antecedent) */
  antecedent: string;
  /** 先行事象のタグ分類 */
  antecedentTags: string[];
  /** 行動 (Behavior) */
  behavior: string;
  /** 結果事象 (Consequence) */
  consequence: string;
  /** 行動強度 (1-5) */
  intensity: BehaviorIntensity;

  // ── 臨床分析（任意） ──
  /** 行動のアウトカム (増加/減少/変化なし) */
  behaviorOutcome?: BehaviorOutcome;
  /** 推定行動機能 (4機能モデル) */
  estimatedFunction?: BehaviorFunction | null;
  /** 使用した介入方法 */
  interventionUsed?: string;

  // ── スケジュール連動（任意） ──
  /** 時間帯ラベル (例: '09:00-10:00') */
  timeSlot?: string;
  /** 計画スロットキー */
  planSlotKey?: string;
  /** 計画されていた活動 */
  plannedActivity?: string;
  /** 実際に観察された内容 */
  actualObservation?: string;
  /** 行動の持続時間（分） */
  durationMinutes?: number;

  // ── コンテキスト（任意） ──
  /** 職員の対応内容 */
  staffResponse?: string;
  /** 利用者の気分 */
  userMood?: BehaviorMood;
  /** フォローアップメモ */
  followUpNote?: string;
}

// ---------------------------------------------------------------------------
// マスタデータ (先行事象/行動/結果の選択肢)
// ---------------------------------------------------------------------------

export interface ObservationMaster {
  antecedents: string[];
  behaviors: string[];
  consequences: string[];
}

export const DEFAULT_OBSERVATION_MASTER: ObservationMaster = {
  antecedents: ['要求却下', '課題提示', '環境変化(音・光)', '待ち時間', '移動/切替', '不明'],
  behaviors: ['自傷(叩く)', '他害(叩く/蹴る)', '器物破損', '大声/奇声', '離席/飛び出し', '拒否/座り込み'],
  consequences: ['見守り', '環境調整', '声かけ', '身体的介入', 'スケジュール再提示'],
};

// ---------------------------------------------------------------------------
// PBS 代替行動レコメンデーション
// ---------------------------------------------------------------------------

export const ALTERNATIVE_BEHAVIOR_RECOMMENDATIONS: Record<BehaviorFunction, string[]> = {
  demand: [
    '絵カードでの要求表現を指導する',
    '選択肢ボードを活用して代替要求手段を提供する',
    'タイマーを使って待機時間を視覚化する',
  ],
  escape: [
    '「休憩カード」の使い方を教える',
    '課題の難易度を段階的に調整する',
    '達成可能な小ステップに分割する',
  ],
  attention: [
    '適切な声かけ行動を強化する',
    '定期的な関わりの時間を確保する',
    'セルフモニタリングシートを導入する',
  ],
  sensory: [
    '感覚統合ツール（フィジェット等）を提供する',
    '感覚ダイエットプログラムを作成する',
    '環境刺激の調整（照明・音量の最適化）を行う',
  ],
};
