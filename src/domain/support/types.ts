/**
 * Legacy Support Activity Types
 *
 * This module provides backward compatibility for existing support activity templates.
 * Extends base support categories with legacy-specific values while maintaining type safety.
 */

import { z } from 'zod';
import {
  supportCategoryValues,
  supportImportanceValues,
  type SupportImportance
} from './step-templates';

/**
 * Extended support activity categories including legacy values
 * Combines base categories with backward compatibility additions
 */
export const supportActivityCategoryValues = [
  ...supportCategoryValues,
  '通所・帰宅', // Legacy-specific category
] as const;
export type SupportActivityCategory = (typeof supportActivityCategoryValues)[number];

// Re-export shared importance values for convenience
export { supportImportanceValues as supportActivityImportanceValues };
export type SupportActivityImportance = SupportImportance;
/**
 * Legacy support activity template (for existing code compatibility)
 */
export const SupportActivityTemplateZ = z.object({
  id: z.string(),
  specificTime: z.string(),
  activityName: z.string(),
  category: z.enum(supportActivityCategoryValues),
  description: z.string(),
  userExpectedActions: z.string(),
  staffSupportMethods: z.string(),
  duration: z.number(),
  importance: z.enum(supportImportanceValues),
  iconEmoji: z.string().optional(),
});

export type SupportActivityTemplate = z.infer<typeof SupportActivityTemplateZ>;

// 既存システムとの互換性のためのデフォルト支援活動テンプレート
export const defaultSupportActivities: Omit<SupportActivityTemplate, 'id'>[] = [
  {
    specificTime: '09:30',
    activityName: '朝の健康確認・受け入れ',
    category: '朝の準備',
    description: '通所者の受け入れ、健康状態チェック、朝の挨拶',
    userExpectedActions: '元気に挨拶する、体調を伝える、荷物を整理する',
    staffSupportMethods: '明るい挨拶、体調確認、荷物整理の支援',
    duration: 30,
    importance: '必須',
    iconEmoji: '🌅'
  },
  {
    specificTime: '10:00',
    activityName: 'AM作業・個別支援',
    category: 'AM活動',
    description: '午前中の個別作業や活動プログラム',
    userExpectedActions: '集中して作業に取り組む、質問や相談をする',
    staffSupportMethods: '作業指導、励ましの声かけ、個別サポート',
    duration: 120,
    importance: '必須',
    iconEmoji: '🔨'
  },
  {
    specificTime: '12:00',
    activityName: '昼食休み',
    category: '昼食',
    description: '昼食の準備、食事、休憩',
    userExpectedActions: '手洗い、配膳手伝い、楽しく食事する、休憩する',
    staffSupportMethods: '衛生管理、配膳支援、食事見守り、休憩環境の確保',
    duration: 105,
    importance: '必須',
    iconEmoji: '🍽️'
  },
  {
    specificTime: '13:45',
    activityName: 'PM活動・レクリエーション',
    category: 'PM活動',
    description: '午後の活動、グループワーク、レクリエーション',
    userExpectedActions: '他の人と協力する、楽しく参加する',
    staffSupportMethods: '活動進行、参加促進、コミュニケーション支援',
    duration: 120,
    importance: '推奨',
    iconEmoji: '🎯'
  },
  {
    specificTime: '15:45',
    activityName: '帰宅準備・振り返り',
    category: '終了準備',
    description: '一日の振り返り、片付け、帰宅準備',
    userExpectedActions: '片付けを手伝う、感想を話す、身だしなみを整える',
    staffSupportMethods: '振り返り支援、片付け指導、帰宅準備確認',
    duration: 30,
    importance: '必須',
    iconEmoji: '📝'
  }
];