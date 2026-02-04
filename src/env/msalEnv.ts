import { z } from 'zod';
import { normalizeHttpsUrl } from './url';

const HttpsUrl = z
  .string()
  .url()
  .refine((v) => v.startsWith('https://'), 'must start with https://');

const MsalEnvSchema = z.object({
  VITE_AZURE_AD_CLIENT_ID: z.string().min(10).optional(),
  VITE_AZURE_AD_TENANT_ID: z.string().min(3).optional(),
  VITE_AZURE_AD_AUTHORITY: HttpsUrl.optional(),
  VITE_AZURE_AD_REDIRECT_URI: HttpsUrl.optional(), // HTTPS 強制（env に入ってる時だけ）
  // Legacy aliases
  VITE_MSAL_CLIENT_ID: z.string().min(10).optional(),
  VITE_MSAL_TENANT_ID: z.string().min(3).optional(),
  VITE_MSAL_AUTHORITY: HttpsUrl.optional(), // HTTPS 強制（env に入ってる時だけ）
  VITE_MSAL_REDIRECT_URI: HttpsUrl.optional(), // HTTPS 強制（env に入ってる時だけ）
  VITE_AAD_CLIENT_ID: z.string().min(10).optional(),
  VITE_AAD_TENANT_ID: z.string().min(3).optional(),
});

export type MsalEnv = z.infer<typeof MsalEnvSchema>;

/**
 * Validates MSAL environment variables only when required keys are present
 * This prevents CI/E2E (HTTP) from failing when env is intentionally not set
 * 
 * @param raw - Environment variables
 * @returns Parsed MsalEnv or null if core keys are missing
 */
export function readMsalEnv(raw: Record<string, unknown>): MsalEnv | null {
  // Check if core MSAL env is present (CLIENT_ID + TENANT_ID + AUTHORITY)
  // All three are required to be considered "real" MSAL config
  const hasCore =
    !!(raw.VITE_MSAL_CLIENT_ID || raw.VITE_AZURE_AD_CLIENT_ID || raw.VITE_AAD_CLIENT_ID) &&
    !!(raw.VITE_MSAL_TENANT_ID || raw.VITE_AZURE_AD_TENANT_ID || raw.VITE_AAD_TENANT_ID) &&
    !!(raw.VITE_MSAL_AUTHORITY || raw.VITE_AZURE_AD_AUTHORITY);

  // If core keys are missing, skip validation (CI/E2E with env未設定)
  if (!hasCore) {
    return null;
  }

  // Parse and validate (throws ZodError if invalid)
  const parsed = MsalEnvSchema.parse(raw);

  // Normalize authority to https if present
  if (parsed.VITE_MSAL_AUTHORITY) {
    parsed.VITE_MSAL_AUTHORITY = normalizeHttpsUrl(parsed.VITE_MSAL_AUTHORITY);
  }
  if (parsed.VITE_AZURE_AD_AUTHORITY) {
    parsed.VITE_AZURE_AD_AUTHORITY = normalizeHttpsUrl(parsed.VITE_AZURE_AD_AUTHORITY);
  }

  return parsed;
}
