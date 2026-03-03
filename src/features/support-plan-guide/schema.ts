/**
 * SupportPlanGuide — Zod バリデーションスキーマ
 *
 * SharePoint 行パース用スキーマ。
 * Repository 内で SP レスポンスの型安全性を担保する。
 */

import { z } from 'zod';

/**
 * SharePoint 行 → ドメインオブジェクト変換時のバリデーションスキーマ
 *
 * SP REST API が返す JSON レスポンスの各アイテムをパースし、
 * 型安全な SupportPlanDraft への変換を可能にする。
 */
export const supportPlanSpRowSchema = z.object({
  Id: z.number(),
  DraftId: z.string(),
  UserCode: z.string().nullable().default(null),
  DraftName: z.string().default('利用者'),
  FormDataJson: z.string(),
  Status: z.enum(['draft', 'confirmed', 'obsolete']).default('draft'),
  SchemaVersion: z.number().default(2),
  Created: z.string().nullable().optional(),
  Modified: z.string().nullable().optional(),
});

/** Inferred type for a parsed SP row. */
export type SupportPlanSpRow = z.infer<typeof supportPlanSpRowSchema>;
