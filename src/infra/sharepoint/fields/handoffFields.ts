import { z } from "zod";
import { HandoffSchema } from "@/domain/Handoff";

/**
 * SharePoint の Handoff リストのアイテム型
 *
 * ⚠ 旧 `cr015_*` プレフィックスは Power Apps が付与した内部名。
 *   本番 SP `/sites/welfare` の Handoff リストは以下のカスタム列を持つ:
 *     Message, UserCode, UserDisplayName, Category, Severity, Status,
 *     TimeBand, CreatedAt, CreatedByName, IsDraft, MeetingSessionKey,
 *     SourceId, SourceUrl, SourceKey, SourceLabel, CarryOverDate,
 *     SourceType, CreatedBy, ModifiedBy, ModifiedAt
 *
 *   2026-03-19: cr015_ → 実列名に合わせてマッピング修正
 */
export const SPHandoffItemSchema = z.object({
  Id: z.number().int(),
  Title: z.string().nullish(),
  Message: z.string().default(""),
  UserCode: z.string().nullish(),
  Severity: z.string().default("通常"),
  Status: z.string().default("未対応"),
  CreatedByName: z.string().default(""),
  CreatedAt: z.string().nullish(),
  CarryOverDate: z.string().nullish(),
});

export type SPHandoffItem = z.infer<typeof SPHandoffItemSchema>;

/**
 * SharePoint のアイテムをドメインモデルに変換
 *
 * 旧ドメイン `Handoff` 型は priority: "normal"|"high"|"emergency"、
 * status: "unread"|"read" を使う。
 * SP 側は Severity: "通常"|"要注意"|"重要"、Status: "未対応"|"対応中"|"対応済"|"確認済"|"明日へ持越"|"完了"。
 * → 変換マップで橋渡し。
 */

const severityToPriority: Record<string, "normal" | "high" | "emergency"> = {
  "通常": "normal",
  "要注意": "high",
  "重要": "emergency",
};

const statusToReadStatus: Record<string, "unread" | "read"> = {
  "未対応": "unread",
  "対応中": "unread",
  "対応済": "read",
  "確認済": "read",
  "明日へ持越": "unread",
  "完了": "read",
};

export const mapSPToHandoff = (item: SPHandoffItem): z.infer<typeof HandoffSchema> => {
  const priority = severityToPriority[item.Severity] ?? "normal";
  const status = statusToReadStatus[item.Status] ?? "unread";

  return HandoffSchema.parse({
    id: String(item.Id),
    userId: item.UserCode || "",
    targetDate: item.CarryOverDate || new Date().toISOString().slice(0, 10),
    content: item.Message,
    priority,
    status,
    reporterName: item.CreatedByName,
    recordedAt: item.CreatedAt || new Date().toISOString(),
  });
};

/**
 * ドメインモデルから SharePoint 用のペイロードを作成
 */
const priorityToSeverity: Record<string, string> = {
  normal: "通常",
  high: "要注意",
  emergency: "重要",
};

export const mapHandoffToSPPayload = (handoff: z.infer<typeof HandoffSchema>) => {
  return {
    Title: `${handoff.userId || 'ALL'}_${handoff.targetDate}_${handoff.priority}`,
    Message: handoff.content,
    UserCode: handoff.userId || "",
    Severity: priorityToSeverity[handoff.priority] || "通常",
    Status: "未対応",
    CreatedByName: handoff.reporterName,
    CreatedAt: handoff.recordedAt,
    CarryOverDate: handoff.targetDate,
  };
};
