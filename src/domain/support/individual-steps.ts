import { z } from 'zod';
import { TimeSlotZ } from './step-templates';

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
  category: z.enum([
    '朝の準備', '健康確認', '活動準備', 'AM活動', '昼食準備',
    '昼食', '休憩', 'PM活動', '終了準備', '振り返り', 'その他'
  ]),
  description: z.string(), // 支援手順の詳細説明
  targetBehavior: z.string(), // 目標とする本人の行動（個別カスタマイズ済み）
  supportMethod: z.string(), // 職員の具体的支援方法（個別カスタマイズ済み）
  precautions: z.string().optional(), // 注意点・配慮事項（個別対応）
  duration: z.number(), // 予想時間（分）
  importance: z.enum(['必須', '推奨', '任意']), // 重要度
  isRequired: z.boolean().default(true), // 必須実施かどうか
  iconEmoji: z.string().optional(), // 表示用アイコン絵文字

  // 個別対応用の追加フィールド
  personalNotes: z.string().optional(), // 個人的な特記事項
  specialConsiderations: z.string().optional(), // 特別な配慮事項
  communicationMethod: z.string().optional(), // コミュニケーション方法
  motivationTips: z.string().optional(), // やる気を引き出すコツ
  difficultyLevel: z.enum(['易しい', '普通', '難しい']).optional(), // 本人にとっての難易度

  // メタ情報
  createdAt: z.string(), // 作成日時
  updatedAt: z.string(), // 更新日時
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
  birthDate: z.string().optional(),
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
  createdAt: z.string(),
  updatedAt: z.string(),
  effectiveFrom: z.string(), // 有効開始日
  effectiveTo: z.string().optional(), // 有効終了日
  createdBy: z.string(), // 作成者
  approvedBy: z.string().optional(), // 承認者
  status: z.enum(['作成中', '承認待ち', '承認済み', '実施中', '完了', '無効']).default('作成中'),
});

export type UserSupportPlan = z.infer<typeof UserSupportPlanZ>;

/**
 * テンプレートから個別支援手順への変換ヘルパー
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
 * サンプル利用者データ
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