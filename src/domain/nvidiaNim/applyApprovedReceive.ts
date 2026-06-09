import { z } from 'zod';

export const NVIDIA_APPLY_APPROVED_DRYRUN_SCHEMA_VERSION = 'nvidia-nim-apply-approved-dry-run/1.0';

const schemaLabel = 'apply-approved-dry-run payload schema';

export const nvidiaApplyApprovedItemSchema = z.object({
  artifactId: z.string().min(1),
  path: z.string().min(1),
  suggestedTitle: z.string(),
  labels: z.array(z.string()),
  reason: z.string(),
}).strict();

export const nvidiaApplyApprovedWarningSchema = z.object({
  type: z.string().min(1),
  line: z.number().int().nonnegative(),
  message: z.string().min(1),
  raw: z.unknown().optional(),
}).strict();

const summarySchema = z.object({
  total: z.number().int().nonnegative(),
  approved: z.number().int().nonnegative(),
  failed: z.number().int().nonnegative(),
});

export const nvidiaApplyApprovedPlanSchema = z
  .object({
    schemaVersion: z.literal(NVIDIA_APPLY_APPROVED_DRYRUN_SCHEMA_VERSION),
    generatedAt: z.string().min(1),
    inputPath: z.string().min(1),
    summary: summarySchema,
    items: z.array(nvidiaApplyApprovedItemSchema),
    warnings: z.array(nvidiaApplyApprovedWarningSchema).default([]),
    preflight: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type NvidiaApplyApprovedItem = z.infer<typeof nvidiaApplyApprovedItemSchema>;
export type NvidiaApplyApprovedWarning = z.infer<typeof nvidiaApplyApprovedWarningSchema>;
export type NvidiaApplyApprovedPlanSummary = z.infer<typeof summarySchema>;
export type NvidiaApplyApprovedPlan = z.infer<typeof nvidiaApplyApprovedPlanSchema>;

export type ValidateApplyApprovedPlanResult =
  | {
      success: true;
      payload: NvidiaApplyApprovedPlan;
      errors: string[];
    }
  | {
      success: false;
      payload: null;
      errors: string[];
    };

function formatZodError(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join('.') : schemaLabel;
    return `${path}: ${issue.message}`;
  });
}

export function validateApplyApprovedPlan(raw: unknown): ValidateApplyApprovedPlanResult {
  const result = nvidiaApplyApprovedPlanSchema.safeParse(raw);

  if (!result.success) {
    return {
      success: false,
      payload: null,
      errors: formatZodError(result.error),
    };
  }

  return {
    success: true,
    payload: result.data,
    errors: [],
  };
}

export function parseApplyApprovedPlanJson(text: string): ValidateApplyApprovedPlanResult {
  try {
    const parsed = JSON.parse(text);
    return validateApplyApprovedPlan(parsed);
  } catch {
    return {
      success: false,
      payload: null,
      errors: ['payload: invalid JSON'],
    };
  }
}
