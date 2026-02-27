// ---------------------------------------------------------------------------
// ABCRecord Zod Validation Schema
//
// SharePoint永続化時のバリデーション + フォーム入力検証に使用
// ---------------------------------------------------------------------------

import { z } from 'zod';

export const behaviorIntensitySchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const behaviorMoodSchema = z.enum([
  '良好', '普通', 'やや不安定', '不安定', '高揚', '疲労',
]);

export const behaviorFunctionSchema = z.enum([
  'demand', 'escape', 'attention', 'sensory',
]);

export const behaviorOutcomeSchema = z.enum([
  'increased', 'decreased', 'unchanged',
]);

export const abcRecordSchema = z.object({
  id: z.string().min(1, 'IDは必須です'),
  userId: z.string().min(1, '利用者IDは必須です'),

  // 時間
  recordedAt: z.string().datetime('ISO 8601形式の日時が必要です'),
  recordedBy: z.string().optional(),

  // ABC
  antecedent: z.string().min(1, '先行事象は必須です'),
  antecedentTags: z.array(z.string()).default([]),
  behavior: z.string().min(1, '行動は必須です'),
  consequence: z.string().min(1, '結果事象は必須です'),
  intensity: behaviorIntensitySchema,

  // 臨床分析
  behaviorOutcome: behaviorOutcomeSchema.optional(),
  estimatedFunction: behaviorFunctionSchema.nullable().optional(),
  interventionUsed: z.string().optional(),

  // スケジュール連動
  timeSlot: z.string().optional(),
  planSlotKey: z.string().optional(),
  plannedActivity: z.string().optional(),
  actualObservation: z.string().optional(),
  durationMinutes: z.number().int().min(0).optional(),

  // コンテキスト
  staffResponse: z.string().optional(),
  userMood: behaviorMoodSchema.optional(),
  followUpNote: z.string().optional(),
});

export type ABCRecordValidated = z.infer<typeof abcRecordSchema>;

/**
 * ABCRecordのパーシャルスキーマ（フォーム入力の段階的バリデーション用）
 */
export const abcRecordPartialSchema = abcRecordSchema.partial();
