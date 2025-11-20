import { z } from 'zod';

// 標準営業時間（9:30-16:00）での時間帯
export const standardTimeSlotValues = [
  '09:30-10:30',
  '10:30-11:30',
  '11:30-12:30',
  '12:30-13:30',
  '13:30-14:30',
  '14:30-15:30',
  '15:30-16:00',
] as const;

// 拡張時間帯（早朝・延長対応を含む）
export const extendedTimeSlotValues = [
  '08:00-09:00', '09:00-10:00', '10:00-11:00', '11:00-12:00', '12:00-13:00',
  '13:00-14:00', '14:00-15:00', '15:00-16:00', '16:00-17:00', '17:00-18:00'
] as const;

export type TimeSlot = (typeof standardTimeSlotValues)[number];
export type ExtendedTimeSlot = (typeof extendedTimeSlotValues)[number];

// 下位互換性のためのエイリアス
export const timeSlotValues = standardTimeSlotValues;

export const supportCategoryValues = [
  '朝の準備',
  '健康確認',
  '活動準備',
  'AM活動',
  '昼食準備',
  '昼食',
  '休憩',
  'PM活動',
  '終了準備',
  '振り返り',
  'その他',
] as const;

export type SupportCategory = (typeof supportCategoryValues)[number];

export const supportImportanceValues = ['必須', '推奨', '任意'] as const;
export type SupportImportance = (typeof supportImportanceValues)[number];

/**
 * 時間帯区分（開所時間 9:30-16:00）
 */
export const TimeSlotZ = z.enum(standardTimeSlotValues);

/**
 * 支援手順テンプレート（個別支援手順の雛形）
 */
export const SupportStepTemplateZ = z.object({
  id: z.string(),
  timeSlot: TimeSlotZ, // 対象時間帯
  stepTitle: z.string(), // 支援手順のタイトル
  category: z.enum(supportCategoryValues),
  description: z.string(), // 支援手順の詳細説明
  targetBehavior: z.string(), // 目標とする本人の行動
  supportMethod: z.string(), // 職員の具体的支援方法
  precautions: z.string().optional(), // 注意点・配慮事項
  duration: z.number(), // 予想時間（分）
  importance: z.enum(supportImportanceValues), // 重要度
  isRequired: z.boolean().default(true), // 必須実施かどうか
  iconEmoji: z.string().optional(), // 表示用アイコン絵文字
  isDefault: z.boolean().optional(), // デフォルトテンプレートかどうか（オプショナル）
});

export type SupportStepTemplate = z.infer<typeof SupportStepTemplateZ>;

// デフォルトの支援手順テンプレート（開所時間 9:30-16:00）
// 注意: isDefaultフラグは実際のID付与時に追加されるため、ここでは含めない
export const defaultSupportStepTemplates: Omit<SupportStepTemplate, 'id'>[] = [
  {
    timeSlot: '09:30-10:30',
    stepTitle: '通所・朝の健康確認',
    category: '朝の準備',
    description: '事業所への通所・到着時の受け入れと朝の健康チェック',
    targetBehavior: '挨拶をする、荷物を所定の場所に置く、体調を伝える、朝の会に参加する',
    supportMethod: '笑顔で迎える、荷物の整理を一緒に行う、体調確認をする、朝の会の進行支援',
    precautions: '体調変化がないか観察し、必要に応じて記録する',
    duration: 60,
    importance: '必須',
    isRequired: true,
    iconEmoji: '🚌'
  },
  {
    timeSlot: '10:30-11:30',
    stepTitle: 'AM個別作業',
    category: 'AM活動',
    description: '個人に合わせた作業課題の実施（午前の部）',
    targetBehavior: '作業手順を確認する、集中して取り組む、完成まで継続する、分からない時は質問する',
    supportMethod: '作業説明、適度な声かけ、進捗の確認と励まし、必要に応じて手順の再説明',
    precautions: '個人のペースを尊重し、無理強いしない。達成感を感じられるよう配慮する',
    duration: 60,
    importance: '必須',
    isRequired: true,
    iconEmoji: '🔨'
  },
  {
    timeSlot: '11:30-12:30',
    stepTitle: '昼食準備・摂取',
    category: '昼食準備',
    description: '昼食前の準備と食事の開始',
    targetBehavior: '作業を片付ける、手洗い・うがいをする、配膳の準備を手伝う、適切なペースで食事する',
    supportMethod: '片付けの声かけ、手洗い・うがいの介助、配膳準備の支援、食事ペースの見守り',
    precautions: '衛生面に注意し、食事量や摂取状況を観察する',
    duration: 60,
    importance: '必須',
    isRequired: true,
    iconEmoji: '🧼'
  },
  {
    timeSlot: '12:30-13:30',
    stepTitle: '昼食・休憩',
    category: '昼食',
    description: '昼食の継続と食後の休憩時間',
    targetBehavior: '最後まで食事を摂る、食事の感想を伝える、食後の片付けを手伝う、適度に休憩する',
    supportMethod: '食事介助、摂取量の確認、会話での見守り、片付けの支援、休憩環境の整備',
    precautions: '消化を考慮し、激しい運動は避ける。水分摂取を促す',
    duration: 60,
    importance: '必須',
    isRequired: true,
    iconEmoji: '🍽️'
  },
  {
    timeSlot: '13:30-14:30',
    stepTitle: 'グループ活動',
    category: 'PM活動',
    description: '集団でのレクリエーション・社会性向上活動',
    targetBehavior: '他の人と協力する、ルールを守る、楽しく参加する、コミュニケーションを取る',
    supportMethod: '活動の進行、参加の促進、トラブル時の仲裁、適切な声かけ、協調性の支援',
    precautions: 'トラブル予防に注意し、全員が参加できるよう配慮する',
    duration: 60,
    importance: '推奨',
    isRequired: false,
    iconEmoji: '🎯'
  },
  {
    timeSlot: '14:30-15:30',
    stepTitle: 'PM個別支援',
    category: 'PM活動',
    description: '個別のニーズに応じた支援と午後の作業',
    targetBehavior: '個別の課題に取り組む、職員と相談する、集中して作業する、成果を確認する',
    supportMethod: '個別ニーズの把握、個人に応じた支援提供、作業指導、成果の確認と評価',
    precautions: '疲労度を考慮し、無理のない範囲で実施する',
    duration: 60,
    importance: '必須',
    isRequired: true,
    iconEmoji: '👥'
  },
  {
    timeSlot: '15:30-16:00',
    stepTitle: '片付け・帰宅準備・振り返り',
    category: '終了準備',
    description: '一日の終わりの片付けと帰宅準備、一日の振り返り',
    targetBehavior: '使った道具を片付ける、荷物をまとめる、今日の感想を話す、身だしなみを整える',
    supportMethod: '片付け方法の指導、持ち物チェック、振り返りの聞き取り、身だしなみ確認・支援',
    precautions: '忘れ物がないよう確認し、帰宅時の安全に配慮する',
    duration: 30,
    importance: '必須',
    isRequired: true,
    iconEmoji: '📝'
  }
];