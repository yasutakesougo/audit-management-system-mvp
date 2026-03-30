import { z } from 'zod';

/**
 * SupportProcedure_Results Zod Schema
 */
export const spResultRowSchema = z.object({
  Id: z.number(),
  ParentScheduleId: z.number(),
  ResultDate: z.string(), // ISO String
  ResultStatus: z.enum(['Completed', 'Skipped', 'PartiallyDone']).optional().nullable(),
  ResultNote: z.string().optional().nullable(),
  StaffCode: z.string().optional().nullable(),
  Created: z.string().optional(),
});

export type SpResultRow = z.infer<typeof spResultRowSchema>;

/**
 * Approval_Logs Zod Schema
 */
export const spApprovalLogRowSchema = z.object({
  Id: z.number(),
  ParentScheduleId: z.number(),
  ApprovedBy: z.string(),
  ApprovedAt: z.string(), // ISO String
  ApprovalNote: z.string().optional().nullable(),
  ApprovalAction: z.enum(['Approved', 'Rejected', 'Reverted']),
  Created: z.string().optional(),
});

export type SpApprovalLogRow = z.infer<typeof spApprovalLogRowSchema>;

/**
 * User_Feature_Flags Zod Schema
 */
export const spUserFlagRowSchema = z.object({
  Id: z.number(),
  UserCode: z.string(),
  FlagKey: z.string(),
  FlagValue: z.string().optional().nullable(),
  ExpiresAt: z.string().optional().nullable(),
});

export type SpUserFlagRow = z.infer<typeof spUserFlagRowSchema>;
