import { z } from 'zod';

/**
 * Zod schema for Audit Insert Item (DTO).
 * Used to validate data before sending to SharePoint.
 */
export const auditInsertSchema = z.object({
  Title: z.string().min(1),
  ts: z.string(), // ISO date string
  actor: z.string().min(1),
  action: z.string().min(1),
  entity: z.string().min(1),
  entity_id: z.string().nullable(),
  channel: z.enum(['system', 'user', 'auto']),
  after_json: z.string().nullable(),
  entry_hash: z.string().min(1),
});

/**
 * Zod schema for Audit List Item (DTO).
 * Used to validate data received from SharePoint.
 */
export const auditListItemSchema = z.object({
  Id: z.number(),
  Title: z.string(),
  ts: z.string(),
  actor: z.string(),
  action: z.string(),
  entity: z.string(),
  entity_id: z.string().nullable(),
  channel: z.string(),
  after_json: z.string().nullable(),
  entry_hash: z.string(),
});

export type AuditInsertSchema = z.infer<typeof auditInsertSchema>;
export type AuditListItemSchema = z.infer<typeof auditListItemSchema>;
