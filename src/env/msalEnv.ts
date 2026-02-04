import { z } from 'zod';

const HttpsUrl = z
  .string()
  .url()
  .refine((v) => v.startsWith('https://'), 'must start with https://');

const MsalEnvSchema = z.object({
  VITE_AZURE_AD_CLIENT_ID: z.string().min(10).optional(),
  VITE_AZURE_AD_TENANT_ID: z.string().min(3).optional(),
  VITE_AZURE_AD_AUTHORITY: HttpsUrl.optional(),
  VITE_AZURE_AD_REDIRECT_URI: z.string().min(1).optional(),
  // Legacy aliases
  VITE_MSAL_CLIENT_ID: z.string().min(10).optional(),
  VITE_MSAL_TENANT_ID: z.string().min(3).optional(),
  VITE_AAD_CLIENT_ID: z.string().min(10).optional(),
  VITE_AAD_TENANT_ID: z.string().min(3).optional(),
});

export type MsalEnv = z.infer<typeof MsalEnvSchema>;

/**
 * Validates MSAL environment variables at startup
 * Throws ZodError if validation fails (fail-fast pattern)
 * - Production/CI: Throws immediately on invalid config
 * - Dev: Same behavior for early error detection
 */
export function readMsalEnv(raw: Record<string, unknown>): MsalEnv {
  return MsalEnvSchema.parse(raw);
}
