import { z } from 'zod';
import { normalizeHttpsUrl } from './url';

// Preprocess to trim whitespace and treat empty strings as undefined
const preprocessTrimmed = (schema: z.ZodTypeAny) => z.preprocess((v) => {
  // null/undefined は通す
  if (v == null) return v;

  // string 以外は通す（zod が弾く）
  if (typeof v !== 'string') return v;

  // 先頭/末尾の空白を削除
  const trimmed = v.trim();

  // 空文字は undefined に変換（未設定扱い）
  return trimmed === '' ? undefined : trimmed;
}, schema);

// HTTPS 強制（authority は本番/CI 共に https必須）
const HttpsUrl = preprocessTrimmed(
  z.string().url()
    .refine((v) => v.startsWith('https://'), 'must start with https://')
).optional();

// Redirect URI は例外: CI で http://localhost許容
const HttpsOrLocalhostUrl = preprocessTrimmed(
  z.string().url()
    .refine(
      (v) =>
        v.startsWith('https://') ||
        v.startsWith('http://localhost') ||
        v.startsWith('http://127.0.0.1'),
      'must start with https:// (or http://localhost/127.0.0.1 for CI)'
    )
).optional();

const MsalEnvSchema = z.object({
  VITE_AZURE_AD_CLIENT_ID: z.string().min(10).optional(),
  VITE_AZURE_AD_TENANT_ID: z.string().min(3).optional(),
  VITE_AZURE_AD_AUTHORITY: HttpsUrl.optional(),
  VITE_AZURE_AD_REDIRECT_URI: HttpsOrLocalhostUrl.optional(),
  // Legacy aliases
  VITE_MSAL_CLIENT_ID: z.string().min(10).optional(),
  VITE_MSAL_TENANT_ID: z.string().min(3).optional(),
  VITE_MSAL_AUTHORITY: HttpsUrl.optional(),
  VITE_MSAL_REDIRECT_URI: HttpsOrLocalhostUrl.optional(),
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
  // Check if core MSAL env is present (CLIENT_ID + TENANT_ID only)
  // AUTHORITY is optional and will be constructed if missing
  const hasCore =
    !!(raw.VITE_MSAL_CLIENT_ID || raw.VITE_AZURE_AD_CLIENT_ID || raw.VITE_AAD_CLIENT_ID) &&
    !!(raw.VITE_MSAL_TENANT_ID || raw.VITE_AZURE_AD_TENANT_ID || raw.VITE_AAD_TENANT_ID);

  // If core keys are missing, skip validation (CI/E2E with env未設定)
  if (!hasCore) {
    return null;
  }

  // Parse and validate (throws ZodError if invalid)
  const parsed = MsalEnvSchema.parse(raw);

  // Normalize authority to https if present
  if (parsed.VITE_MSAL_AUTHORITY && typeof parsed.VITE_MSAL_AUTHORITY === 'string') {
    parsed.VITE_MSAL_AUTHORITY = normalizeHttpsUrl(parsed.VITE_MSAL_AUTHORITY);
  }
  if (parsed.VITE_AZURE_AD_AUTHORITY && typeof parsed.VITE_AZURE_AD_AUTHORITY === 'string') {
    parsed.VITE_AZURE_AD_AUTHORITY = normalizeHttpsUrl(parsed.VITE_AZURE_AD_AUTHORITY);
  }

  return parsed;
}
