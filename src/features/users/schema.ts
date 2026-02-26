import { z } from 'zod';

/**
 * Zod schema for User Master Item (DTO).
 * Used to validate user data from SharePoint.
 */
export const userMasterSchema = z.object({
  Id: z.number(),
  Title: z.string().nullable().optional(),
  UserID: z.string().min(1, 'UserID is required'),
  FullName: z.string().min(1, 'FullName is required'),
  OrgCode: z.string().nullable().optional(),
  OrgName: z.string().nullable().optional(),
  Role: z.string().nullable().optional(),
  Email: z.string().email().nullable().optional(),
  IsDisabled: z.boolean().optional().default(false),
});

/**
 * Zod schema for User Master Create (DTO).
 * Used to validate data before sending to SharePoint.
 */
export const userMasterCreateSchema = z.object({
  Title: z.string().nullable().optional(),
  UserID: z.string().min(1),
  FullName: z.string().min(1),
  OrgCode: z.string().nullable().optional(),
  OrgName: z.string().nullable().optional(),
  Role: z.string().nullable().optional(),
  Email: z.string().email().nullable().optional(),
  IsDisabled: z.boolean().optional().default(false),
});

export type UserMasterSchema = z.infer<typeof userMasterSchema>;
export type UserMasterCreateSchema = z.infer<typeof userMasterCreateSchema>;
