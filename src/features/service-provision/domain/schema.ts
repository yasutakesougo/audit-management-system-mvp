/**
 * ServiceProvisionRecords Zodスキーマ（MVP0最小バリデーション）
 */
import { z } from 'zod';

export const recordDateISOSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD形式で入力してください');

export const upsertProvisionInputSchema = z.object({
  userCode: z.string().min(1, '利用者コードは必須です'),
  recordDateISO: recordDateISOSchema,
  status: z.enum(['提供', '欠席', 'その他']),

  startHHMM: z.number().int().min(0).max(2359).nullable().optional(),
  endHHMM: z.number().int().min(0).max(2359).nullable().optional(),

  hasTransport: z.boolean().optional(),
  hasMeal: z.boolean().optional(),
  hasBath: z.boolean().optional(),
  hasExtended: z.boolean().optional(),
  hasAbsentSupport: z.boolean().optional(),

  note: z.string().max(2000).optional(),
  source: z.enum(['Unified', 'Daily', 'Attendance', 'Import']).optional(),
  updatedByUPN: z.string().optional(),
});

export type UpsertProvisionInputParsed = z.infer<typeof upsertProvisionInputSchema>;
