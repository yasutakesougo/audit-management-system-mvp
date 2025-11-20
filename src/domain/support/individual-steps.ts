/**
 * Individual Support Steps Domain Types
 *
 * This module defines types for personalized support step management for individual users.
 * Supports workflow: template → individualized steps → support plan → execution tracking
 *
 * Key components:
 * - Support category/importance/difficulty enums for UI consistency
 * - Individual support step schema with personalization fields
 * - User support plan grouping multiple steps with lifecycle management
 * - Template-to-individual conversion utilities
 * - Type-safe enum values for frontend select components
 */

import { z } from 'zod';
import {
  TimeSlotZ,
  supportCategoryValues,
  supportImportanceValues,
  type SupportCategory,
  type SupportImportance
} from './step-templates';

// Additional enums specific to individual steps
export const difficultyLevelValues = ['易しい', '普通', '難しい'] as const;
export type DifficultyLevel = (typeof difficultyLevelValues)[number];

export const supportPlanStatusValues = ['作成中', '承認待ち', '承認済み', '実施中', '完了', '無効'] as const;
export type SupportPlanStatus = (typeof supportPlanStatusValues)[number];

// Re-export shared types and values for convenience
export { supportCategoryValues, supportImportanceValues, type SupportCategory, type SupportImportance };

// Date validation schema for consistency with other modules
const YmdString = z.string()
  .regex(/^(\d{4})-(\d{2})-(\d{2})$/, 'YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(value + 'T00:00:00Z');
    return !isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, '有効な日付を入力してください');

/**
 * 利用者ごとの個別支援手順
 */
export const IndividualSupportStepZ = z.object({
  id: z.string(),
  userId: z.string(), // 利用者ID
  userName: z.string(), // 利用者名（表示用）
  templateId: z.string().optional(), // 元となったテンプレートID
  timeSlot: TimeSlotZ, // 対象時間帯
  stepTitle: z.string(), // 支援手順のタイトル
  category: z.enum(supportCategoryValues),
  description: z.string(), // 支援手順の詳細説明
  targetBehavior: z.string(), // 目標とする本人の行動（個別カスタマイズ済み）
  supportMethod: z.string(), // 職員の具体的支援方法（個別カスタマイズ済み）
  precautions: z.string().optional(), // 注意点・配慮事項（個別対応）
  duration: z.number(), // 予想時間（分）
  importance: z.enum(supportImportanceValues), // 重要度
  isRequired: z.boolean().default(true), // 必須実施かどうか
  iconEmoji: z.string().optional(), // 表示用アイコン絵文字

  // 個別対応用の追加フィールド
  personalNotes: z.string().optional(), // 個人的な特記事項
  specialConsiderations: z.string().optional(), // 特別な配慮事項
  communicationMethod: z.string().optional(), // コミュニケーション方法
  motivationTips: z.string().optional(), // やる気を引き出すコツ
  difficultyLevel: z.enum(difficultyLevelValues).optional(), // 本人にとっての難易度

  // メタ情報
  createdAt: z.string().datetime(), // 作成日時
  updatedAt: z.string().datetime(), // 更新日時
  createdBy: z.string(), // 作成者
  isActive: z.boolean().default(true), // 有効/無効
});

export type IndividualSupportStep = z.infer<typeof IndividualSupportStepZ>;

/**
 * 利用者の基本情報（簡易版）
 */
export const UserBasicInfoZ = z.object({
  id: z.string(),
  name: z.string(),
  furigana: z.string().optional(),
  birthDate: YmdString.optional(),
  isActive: z.boolean().default(true),
});

export type UserBasicInfo = z.infer<typeof UserBasicInfoZ>;

/**
 * 利用者ごとの支援手順セット
 */
export const UserSupportPlanZ = z.object({
  userId: z.string(),
  userName: z.string(),
  planName: z.string(), // 支援計画名（例：「2025年度個別支援計画」）
  description: z.string().optional(), // 計画の説明
  steps: z.array(IndividualSupportStepZ), // 個別支援手順のリスト

  // 計画のメタ情報
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  effectiveFrom: YmdString, // 有効開始日
  effectiveTo: YmdString.optional(), // 有効終了日
  createdBy: z.string(), // 作成者
  approvedBy: z.string().optional(), // 承認者
  status: z.enum(supportPlanStatusValues).default('作成中'),
});

export type UserSupportPlan = z.infer<typeof UserSupportPlanZ>;

/**
 * Template to individual step conversion helper.
 * Transforms generic template into personalized support step.
 */
export const createIndividualStepFromTemplate = (
  template: Omit<import('./step-templates').SupportStepTemplate, 'id'>,
  userId: string,
  userName: string,
  templateId?: string
): Omit<IndividualSupportStep, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'> => {
  return {
    userId,
    userName,
    templateId,
    timeSlot: template.timeSlot,
    stepTitle: template.stepTitle,
    category: template.category,
    description: template.description,
    targetBehavior: template.targetBehavior,
    supportMethod: template.supportMethod,
    precautions: template.precautions,
    duration: template.duration,
    importance: template.importance,
    isRequired: template.isRequired ?? true,
    iconEmoji: template.iconEmoji,
    isActive: true,
  };
};

/**
 * Create empty user support plan with minimal required fields.
 * Leverages schema defaults and generates initial timestamps.
 */
export const createEmptyUserSupportPlan = (
  user: UserBasicInfo,
  planName: string,
  createdBy: string
): UserSupportPlan => {
  const now = new Date();
  const todayYmd = now.toISOString().slice(0, 10); // YYYY-MM-DD

  return {
    userId: user.id,
    userName: user.name,
    planName,
    description: '',
    steps: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    effectiveFrom: todayYmd,
    effectiveTo: undefined,
    createdBy,
    approvedBy: undefined,
    status: '作成中',
  };
};

/**
 * Sample user data for development and testing.
 * NOTE: For Storybook/testing use only. Production data comes from SharePoint.
 */
export const sampleUsers: UserBasicInfo[] = [
  {
    id: 'user-001',
    name: '田中 太郎',
    furigana: 'たなか たろう',
    birthDate: '1990-04-15',
    isActive: true,
  },
  {
    id: 'user-002',
    name: '佐藤 花子',
    furigana: 'さとう はなこ',
    birthDate: '1985-08-22',
    isActive: true,
  },
  {
    id: 'user-003',
    name: '鈴木 次郎',
    furigana: 'すずき じろう',
    birthDate: '1992-12-03',
    isActive: true,
  },
];