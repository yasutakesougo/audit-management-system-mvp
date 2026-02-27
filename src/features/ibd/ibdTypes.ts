// ---------------------------------------------------------------------------
// 強度行動障害 (IBD) 支援システム 型定義
// Intensive Behavioral Disorder support system type definitions
// ---------------------------------------------------------------------------

// ===== 支援計画シート (SPS) =====

/** 支援計画シート (SPS) — 障害特性に基づく環境調整の戦略図 */
export interface SupportPlanSheet {
  id: string;
  userId: number;             // 対象利用者ID
  version: string;
  createdAt: string;          // 作成日（ISO 8601）
  updatedAt: string;          // 最終更新日
  nextReviewDueDate: string;  // 次回見直し期限（createdAt + 90日）
  status: SPSStatus;
  confirmedBy: number | null; // 確定した実践研修修了者のユーザーID
  confirmedAt: string | null;

  // 氷山モデル分析
  icebergModel: IcebergModel;

  // 良い状態の条件（予防的支援の核）
  positiveConditions: string[];
}

export type SPSStatus = 'draft' | 'confirmed' | 'expired';

export interface IcebergModel {
  observableBehaviors: string[];       // 表面的な行動（見えている部分）
  underlyingFactors: string[];        // 背景要因（見えていない部分）
  environmentalAdjustments: string[]; // 環境調整の方針
}

// ===== 支援手順書 (Manual) =====

/** 支援手順書 — 場面別の具体的な支援マニュアル */
export interface SupportProcedureManual {
  id: string;
  spsId: string;              // 紐付くSPSのID
  userId: number;
  version: string;
  createdAt: string;
  updatedAt: string;
  supervisedBy: number | null; // 監修した実践研修修了者ID

  // 場面別手順
  scenes: SupportScene[];
}

// ===== 場面別支援 =====

/** 場面別支援手順 */
export interface SupportScene {
  id: string;
  sceneType: SceneType;
  label: string;                       // 「朝の来所」「食事」等
  iconKey: string;                     // MUI Icon名
  positiveConditions: string[];        // この場面での良い状態
  procedures: SupportProcedureStep[];
}

export type SceneType =
  | 'arrival'      // 来所時
  | 'meal'         // 食事
  | 'activity'     // 活動
  | 'transition'   // 場面転換
  | 'panic'        // パニック時
  | 'departure'    // 帰宅準備
  | 'other';       // その他

/** 場面タイプの日本語ラベル */
export const SCENE_TYPE_LABELS: Record<SceneType, string> = {
  arrival: '来所時',
  meal: '食事',
  activity: '活動',
  transition: '場面転換',
  panic: 'パニック時',
  departure: '帰宅準備',
  other: 'その他',
} as const;

/** 場面タイプのMUIアイコン名 */
export const SCENE_TYPE_ICONS: Record<SceneType, string> = {
  arrival: 'DirectionsWalk',
  meal: 'Restaurant',
  activity: 'SportsEsports',
  transition: 'SwapHoriz',
  panic: 'Warning',
  departure: 'Home',
  other: 'MoreHoriz',
} as const;

export interface SupportProcedureStep {
  order: number;
  personAction: string;       // 本人の行動
  supporterAction: string;    // 支援者の関わり
  stage: SupportStrategyStage;
  /** カラーカードカテゴリ（省略時は stage から自動推定） */
  category?: SupportCategory;
}

export type SupportStrategyStage =
  | 'proactive'        // 予防的支援
  | 'earlyResponse'    // 早期対応
  | 'crisisResponse'   // 危機対応
  | 'postCrisis';      // 事後対応

/** 支援段階の日本語ラベル */
export const STRATEGY_STAGE_LABELS: Record<SupportStrategyStage, string> = {
  proactive: '予防的支援',
  earlyResponse: '早期対応',
  crisisResponse: '危機対応',
  postCrisis: '事後対応',
} as const;

// ===== 支援カテゴリ（カラーカード体系） =====

/** 支援種別カテゴリ — 臨床的な3分類 */
export type SupportCategory =
  | 'environmental'   // 環境調整（緑）
  | 'interaction'     // やりとりの工夫（黄）
  | 'riskManagement'; // リスク管理（赤）

/** 支援カテゴリのカラーカード定義 */
export const SUPPORT_CATEGORY_CONFIG: Record<SupportCategory, {
  label: string;
  color: string;       // MUI カラーパレットキー
  bgColor: string;     // 背景色
  iconName: string;    // MUI アイコン名
  examples: string[];  // 具体例
}> = {
  environmental: {
    label: '環境調整',
    color: 'success.main',
    bgColor: 'success.light',
    iconName: 'Tune',
    examples: ['視覚的構造化', 'イヤーマフ', '刺激量の調整', 'スケジュール提示'],
  },
  interaction: {
    label: 'やりとりの工夫',
    color: 'warning.main',
    bgColor: 'warning.light',
    iconName: 'Chat',
    examples: ['PECS（絵カード交換）', 'プロンプト', '選択肢の提示', 'タイマー活用'],
  },
  riskManagement: {
    label: 'リスク管理',
    color: 'error.main',
    bgColor: 'error.light',
    iconName: 'Shield',
    examples: ['安全確保', '物理的距離', 'クールダウンスペース', '応援要請手順'],
  },
} as const;

// ===== 指導・観察ログ =====

/** 実践研修修了者による指導・観察ログ */
export interface SupervisionLog {
  id: string;
  userId: number;           // 対象利用者
  supervisorId: number;     // 実践研修修了者のID
  observedAt: string;       // 観察日時（ISO 8601）
  notes: string;
  actionsTaken: string[];

  // === PDCA フィードバック（Phase 3 追加） ===

  /** 手順書遵守度（1-5: 手順通り実施⇔大幅にズレ） */
  adherenceToManual?: number;
  /** 観察で発見した新しい「良い状態の条件」 */
  discoveredPositiveConditions?: string[];
  /** 手順書更新の提案（現場で気づいた手順のズレ） */
  suggestedProcedureUpdates?: string[];
  /** PDCAサイクルへの推奨アクション */
  pdcaRecommendation?: PDCARecommendation;
}

/** PDCA推奨アクション */
export type PDCARecommendation =
  | 'continue'       // 計画通り継続（Plan通り）
  | 'adjust'         // 微調整が必要
  | 'revise'         // 手順書の大幅見直し
  | 'escalate';      // 上位者へのエスカレーション

export const PDCA_RECOMMENDATION_LABELS: Record<PDCARecommendation, string> = {
  continue: '✅ 計画通り継続',
  adjust: '🔧 微調整が必要',
  revise: '📝 手順書の見直し推奨',
  escalate: '⚠️ エスカレーション',
} as const;

// ===== ユーティリティ =====

/**
 * SPSの次回見直し期限を計算する（作成日から90日後）
 */
export function calculateNextReviewDueDate(createdAt: string): string {
  const date = new Date(createdAt);
  date.setDate(date.getDate() + 90);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * SPSの更新期限までの残り日数を計算する
 * @returns 正の数 = 期限まであと何日、負の数 = 期限超過日数
 */
export function daysUntilSPSReview(nextReviewDueDate: string, today?: string): number {
  const due = new Date(nextReviewDueDate);
  const now = today ? new Date(today) : new Date();
  // UTC基準で日付計算
  const dueUtc = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((dueUtc - nowUtc) / (1000 * 60 * 60 * 24));
}

/**
 * SPSアラートレベルを判定する
 */
export type SPSAlertLevel = 'ok' | 'warning' | 'error';

export function getSPSAlertLevel(daysRemaining: number): SPSAlertLevel {
  if (daysRemaining < 0) return 'error';
  if (daysRemaining <= 14) return 'warning';
  return 'ok';
}

/**
 * 支援段階からカラーカードカテゴリを自動推定する
 * SupportProcedureStep.category が未設定の場合のフォールバック
 */
export function inferCategoryFromStage(stage: SupportStrategyStage): SupportCategory {
  switch (stage) {
    case 'proactive':
      return 'environmental';   // 予防的 → 環境調整（緑）
    case 'earlyResponse':
      return 'interaction';     // 早期対応 → やりとりの工夫（黄）
    case 'crisisResponse':
    case 'postCrisis':
      return 'riskManagement';  // 危機対応・事後 → リスク管理（赤）
  }
}

/**
 * SupportProcedureStep のカテゴリを解決する（明示 > 推定）
 */
export function resolveStepCategory(step: SupportProcedureStep): SupportCategory {
  return step.category ?? inferCategoryFromStage(step.stage);
}

// ===== D-1: 介入方法 =====

/** 手順書から引用可能な介入方法 */
export interface InterventionMethod {
  id: string;
  label: string;               // 介入名（例: 「PECSで要求を伝える」）
  category: SupportCategory;   // カラーカードカテゴリ
  sourceStepOrder?: number;    // 出典の手順書ステップ番号
  sourceSceneId?: string;      // 出典の場面ID
}

/**
 * 手順書の場面配列から介入方法リストを自動生成する
 */
export function extractInterventionMethods(scenes: SupportScene[]): InterventionMethod[] {
  const methods: InterventionMethod[] = [];
  for (const scene of scenes) {
    for (const step of scene.procedures) {
      methods.push({
        id: `${scene.id}-step-${step.order}`,
        label: step.supporterAction,
        category: resolveStepCategory(step),
        sourceStepOrder: step.order,
        sourceSceneId: scene.id,
      });
    }
  }
  return methods;
}

// ===== D-2: ABC分析 =====

/** 行動の機能（応用行動分析の4機能） */
export type BehaviorFunction =
  | 'demand'       // 要求（物や活動を得たい）
  | 'escape'       // 回避・拒否（嫌な刺激から逃れたい）
  | 'attention'    // 注目（他者の関心を得たい）
  | 'sensory';     // 感覚（感覚的な刺激を得たい/避けたい）

export const BEHAVIOR_FUNCTION_LABELS: Record<BehaviorFunction, string> = {
  demand: '🎯 要求',
  escape: '🚪 回避・拒否',
  attention: '👋 注目',
  sensory: '✨ 感覚',
} as const;

export const BEHAVIOR_FUNCTION_COLORS: Record<BehaviorFunction, string> = {
  demand: '#1976d2',
  escape: '#ed6c02',
  attention: '#9c27b0',
  sensory: '#2e7d32',
} as const;

/** 行動変化の方向 */
export type BehaviorOutcome = 'increased' | 'decreased' | 'unchanged';

export const BEHAVIOR_OUTCOME_LABELS: Record<BehaviorOutcome, string> = {
  increased: '↑ 増加',
  decreased: '↓ 減少',
  unchanged: '→ 変化なし',
} as const;

/** ABC分析レコード */
export interface ABCRecord {
  id: string;
  userId: number;
  recordedAt: string;          // 記録日（ISO 8601）
  recordedBy: number;          // 記録者ID

  // A: 先行事象
  antecedent: string;          // 自由記述
  antecedentTags: string[];    // よくあるパターンタグ

  // B: 行動
  behavior: string;            // 具体的な態様
  behaviorIntensity: number;   // 強度（1-5）

  // C: 結果
  consequence: string;         // 周囲の反応
  behaviorOutcome: BehaviorOutcome;

  // 機能推定
  estimatedFunction: BehaviorFunction | null;
  // 使用した介入方法
  interventionUsed?: string;   // InterventionMethod.label
}

/** よくある先行事象のプリセット */
export const COMMON_ANTECEDENT_TAGS: string[] = [
  '予定の変更',
  '待ち時間',
  '騒音・大きな音',
  '要求が通らない',
  '活動の終了',
  '新しい場所・人',
  '体調不良',
  '空腹',
  '指示が理解できない',
  '感覚的な不快',
];

// ===== D-3: ABC集計 =====

/** ABC集計サマリ */
export interface ABCSummary {
  totalRecords: number;
  functionBreakdown: Record<BehaviorFunction, number>;
  topAntecedents: { tag: string; count: number }[];
  averageIntensity: number | null;
  outcomeBreakdown: Record<BehaviorOutcome, number>;
}

/** 機能に基づく代替行動の推奨 */
export const ALTERNATIVE_BEHAVIOR_RECOMMENDATIONS: Record<BehaviorFunction, {
  label: string;
  alternatives: string[];
}> = {
  demand: {
    label: '要求の適切な伝達手段',
    alternatives: [
      'PECSカードで要求を伝える',
      'ジェスチャー（指差し）で選択する',
      '「ちょうだい」カードの使用',
      'タブレットのコミュニケーションアプリ',
    ],
  },
  escape: {
    label: '適切な回避・休憩の要求手段',
    alternatives: [
      '「おしまい」カードの使用',
      '「休憩」カードの提示',
      'タイムアウトスペースへの自発的移動',
      '活動の難易度調整を要求するサイン',
    ],
  },
  attention: {
    label: '適切な注目獲得手段',
    alternatives: [
      '名前を呼んで呼びかけるスキル',
      '肩をトントンするスキル',
      '「見て」カードの使用',
      '適切な声量での発声',
    ],
  },
  sensory: {
    label: '感覚ニーズの代替充足',
    alternatives: [
      'フィジェットツール（ストレスボール等）',
      'ヘッドフォン・イヤーマフの使用',
      '感覚統合遊びの時間確保',
      'ウェイトブランケットの使用',
    ],
  },
} as const;

/**
 * ABCレコード配列からサマリを集計する
 */
export function calculateABCSummary(records: ABCRecord[]): ABCSummary {
  const functionBreakdown: Record<BehaviorFunction, number> = {
    demand: 0, escape: 0, attention: 0, sensory: 0,
  };
  const outcomeBreakdown: Record<BehaviorOutcome, number> = {
    increased: 0, decreased: 0, unchanged: 0,
  };
  const tagCounts = new Map<string, number>();

  let intensitySum = 0;
  let intensityCount = 0;

  for (const rec of records) {
    if (rec.estimatedFunction) {
      functionBreakdown[rec.estimatedFunction]++;
    }
    outcomeBreakdown[rec.behaviorOutcome]++;

    intensitySum += rec.behaviorIntensity;
    intensityCount++;

    for (const tag of rec.antecedentTags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const topAntecedents = Array.from(tagCounts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalRecords: records.length,
    functionBreakdown,
    topAntecedents,
    averageIntensity: intensityCount > 0
      ? Math.round((intensitySum / intensityCount) * 10) / 10
      : null,
    outcomeBreakdown,
  };
}
