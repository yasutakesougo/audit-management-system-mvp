import { z } from 'zod';

// ---------------------------------------------------------------------------
// 行動対応シート（Behavior Intervention Plan）ドメイン型
// 氷山モデルの因果リンクから導出される「条件ベース（If-Then）」の手順
// ---------------------------------------------------------------------------

/**
 * 介入戦略: 対象行動に対する3種類のアプローチ
 * - prevention: 予防的対応（環境調整、事前準備）
 * - alternative: 代替行動の提示（望ましい行動への置換）
 * - reactive: 事後対応（安全確保、クールダウン）
 */
export type InterventionStrategies = {
  prevention: string;
  alternative: string;
  reactive: string;
};

/**
 * 行動対応プラン: 1つの「引き金→行動」パターンに対する対応策
 */
export type BehaviorInterventionPlan = {
  /** 一意なID */
  id: string;
  /** 対象利用者ID */
  userId: string;
  /** 対象行動のラベル（氷山モデルの水上カードから取得） */
  targetBehavior: string;
  /** 元の氷山ノードID（行動カード） */
  targetBehaviorNodeId: string;
  /** 引き金（環境因子/特性）のリスト */
  triggerFactors: Array<{
    label: string;
    nodeId: string;
  }>;
  /** 3種類の対応戦略 */
  strategies: InterventionStrategies;
  /** 作成日時 */
  createdAt: string;
  /** 更新日時 */
  updatedAt: string;
};

/**
 * ユーザー別の行動対応プラン集
 */
export type UserInterventionPlans = {
  userId: string;
  plans: BehaviorInterventionPlan[];
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Zod Validation Schemas
// ---------------------------------------------------------------------------

export const interventionStrategiesSchema = z.object({
  prevention: z.string(),
  alternative: z.string(),
  reactive: z.string(),
});

export const behaviorInterventionPlanSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  targetBehavior: z.string().min(1),
  targetBehaviorNodeId: z.string().min(1),
  triggerFactors: z.array(
    z.object({
      label: z.string(),
      nodeId: z.string(),
    }),
  ),
  strategies: interventionStrategiesSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const userInterventionPlansSchema = z.object({
  userId: z.string().min(1),
  plans: z.array(behaviorInterventionPlanSchema),
  updatedAt: z.string(),
});

/** localStorage の envelope スキーマ */
export const interventionStoreSchema = z.object({
  version: z.literal(1),
  data: z.record(z.string(), userInterventionPlansSchema),
});

export type InterventionStorePayload = z.infer<typeof interventionStoreSchema>;

export const INTERVENTION_DRAFT_KEY = 'interventionDraft.v1';

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/** 空の戦略テンプレートを生成 */
export const createEmptyStrategies = (): InterventionStrategies => ({
  prevention: '',
  alternative: '',
  reactive: '',
});

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** 未入力の戦略フィールドを返す（空ならすべて入力済み） */
export function getIncompleteStrategies(
  plan: BehaviorInterventionPlan,
): (keyof InterventionStrategies)[] {
  const incomplete: (keyof InterventionStrategies)[] = [];
  if (!plan.strategies.prevention?.trim()) incomplete.push('prevention');
  if (!plan.strategies.alternative?.trim()) incomplete.push('alternative');
  if (!plan.strategies.reactive?.trim()) incomplete.push('reactive');
  return incomplete;
}

/** 戦略フィールドの日本語ラベル */
export const STRATEGY_LABELS: Record<keyof InterventionStrategies, string> = {
  prevention: '予防',
  alternative: '代替',
  reactive: '事後',
};
