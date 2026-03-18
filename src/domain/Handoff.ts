import { z } from "zod";

export const HandoffPrioritySchema = z.enum(["normal", "high", "emergency"]);
export type HandoffPriority = z.infer<typeof HandoffPrioritySchema>;

export const HandoffStatusSchema = z.enum(["unread", "read"]);
export type HandoffStatus = z.infer<typeof HandoffStatusSchema>;

export const HandoffSchema = z.object({
  id: z.string().describe("Domain ID (UUID)"),
  userId: z.string().min(1, "対象利用者が指定されていません"),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD形式が必要です"),
  content: z.string().min(1, "申し送り本文は必須です"),
  priority: HandoffPrioritySchema,
  status: HandoffStatusSchema,
  reporterName: z.string().min(1, "記録者が指定されていません"),
  recordedAt: z.string().datetime({ message: "ISOString形式が必要です" }),
});

export type Handoff = z.infer<typeof HandoffSchema>;
