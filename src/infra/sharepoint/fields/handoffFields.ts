import { z } from "zod";
import { HandoffSchema, HandoffPrioritySchema, HandoffStatusSchema } from "@/domain/Handoff";

/**
 * SharePoint の Handoffs リストのアイテム型
 */
export const SPHandoffItemSchema = z.object({
  Id: z.number().int(),
  Title: z.string().nullish(), // 自動生成 `{userId}_{targetDate}_{priority}`
  cr015_recordId: z.string(),
  cr015_userId: z.string().nullish(),
  cr015_targetDate: z.string(),
  cr015_content: z.string(),
  cr015_priority: z.string(),
  cr015_status: z.string(),
  cr015_reporterName: z.string(),
  cr015_recordedAt: z.string(),
});

export type SPHandoffItem = z.infer<typeof SPHandoffItemSchema>;

/**
 * SharePoint のアイテムをドメインモデルに変換
 */
export const mapSPToHandoff = (item: SPHandoffItem): z.infer<typeof HandoffSchema> => {
  const parsedPriority = HandoffPrioritySchema.safeParse(item.cr015_priority);
  const parsedStatus = HandoffStatusSchema.safeParse(item.cr015_status);

  return HandoffSchema.parse({
    id: item.cr015_recordId,
    userId: item.cr015_userId || "",
    targetDate: item.cr015_targetDate,
    content: item.cr015_content,
    priority: parsedPriority.success ? parsedPriority.data : "normal",
    status: parsedStatus.success ? parsedStatus.data : "unread",
    reporterName: item.cr015_reporterName,
    recordedAt: item.cr015_recordedAt,
  });
};

/**
 * ドメインモデルから SharePoint 用のペイロードを作成
 */
export const mapHandoffToSPPayload = (handoff: z.infer<typeof HandoffSchema>) => {
  return {
    Title: `${handoff.userId || 'ALL'}_${handoff.targetDate}_${handoff.priority}`,
    cr015_recordId: handoff.id,
    cr015_userId: handoff.userId || "",
    cr015_targetDate: handoff.targetDate,
    cr015_content: handoff.content,
    cr015_priority: handoff.priority,
    cr015_status: handoff.status,
    cr015_reporterName: handoff.reporterName,
    cr015_recordedAt: handoff.recordedAt,
  };
};
