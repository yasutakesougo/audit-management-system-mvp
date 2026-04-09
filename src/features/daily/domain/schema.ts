import { z } from 'zod';
import { BEHAVIOR_TAG_KEYS } from './behavior/behaviorTag';

/**
 * Schema for an individual user row within a daily record.
 */
export const DailyRecordUserRowSchema = z.object({
  userId: z.union([z.string(), z.number()]).transform(val => String(val)),
  userName: z.string().default(''),
  amActivity: z.string().default(''),
  pmActivity: z.string().default(''),
  lunchAmount: z.string().default(''),
  problemBehavior: z.object({
    selfHarm: z.boolean().default(false),
    otherInjury: z.boolean().default(false),
    loudVoice: z.boolean().default(false),
    pica: z.boolean().default(false),
    other: z.boolean().default(false),
  }).default({
    selfHarm: false,
    otherInjury: false,
    loudVoice: false,
    pica: false,
    other: false,
  }),
  specialNotes: z.string().default(''),
  submittedAt: z.string().optional(),
  behaviorTags: z.array(
    z.enum(BEHAVIOR_TAG_KEYS as unknown as [string, ...string[]])
  ).default([]),
  acceptedSuggestions: z.array(z.object({
    action: z.enum(['accept', 'dismiss']),
    ruleId: z.string(),
    category: z.string(),
    message: z.string(),
    evidence: z.string(),
    timestamp: z.string(),
    userId: z.string(),
  })).optional(),
});

/**
 * Schema for the full domain record (matches TableDailyRecordData)
 */
export const DailyRecordDomainSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  reporter: z.object({
    name: z.string().default(''),
    role: z.string().default(''),
  }),
  userRows: z.array(DailyRecordUserRowSchema).default([]),
  userCount: z.number().default(0),
});

/**
 * Schema for raw SharePoint item before transformation.
 * Note: Uses logical names for consistency across the domain layer.
 */
export const SharePointDailyRecordItemSchema = z.object({
  Id: z.number(),
  Title: z.string().nullish(), // YYYY-MM-DD
  RecordDate: z.string().nullish(),
  ReporterName: z.string().nullish().transform(val => val ?? ''),
  ReporterRole: z.string().nullish().transform(val => val ?? ''),
  UserRowsJSON: z.string().nullish().transform(val => {
    if (!val) return [];
    try {
      return JSON.parse(val);
    } catch {
      console.warn('[Schema] Failed to parse UserRowsJSON', { value: val });
      return [];
    }
  }),
  UserCount: z.number().nullish().transform(val => val ?? 0),
  Created: z.string().nullish(),
  Modified: z.string().nullish(),
  __metadata: z.object({
    etag: z.string().optional(),
  }).optional(),
});

/**
 * Comprehensive schema that transforms SharePoint raw data into the Domain model.
 */
export const DailyRecordItemSchema = SharePointDailyRecordItemSchema.transform((sp): z.infer<typeof DailyRecordDomainSchema> & { id: string; createdAt?: string; modifiedAt?: string } => {
  return {
    id: String(sp.Id),
    date: sp.Title ?? '',
    reporter: {
      name: sp.ReporterName,
      role: sp.ReporterRole,
    },
    // Map UserRowsJSON back to userRows
    userRows: z.array(DailyRecordUserRowSchema).parse(sp.UserRowsJSON),
    userCount: sp.UserCount ?? 0,
    createdAt: sp.Created ?? undefined,
    modifiedAt: sp.Modified ?? undefined,
  };
});

export type SpDailyRecordRaw = z.infer<typeof SharePointDailyRecordItemSchema>;
export type DailyRecordUserRow = z.infer<typeof DailyRecordUserRowSchema>;
export type DailyRecordDomain = z.infer<typeof DailyRecordDomainSchema>;

export interface SharePointDailyRecordPayload {
  Title: string;
  RecordDate: string;
  ReporterName: string;
  ReporterRole: string;
  UserRowsJSON: string;
  UserCount: number;
}
