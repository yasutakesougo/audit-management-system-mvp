/* eslint-disable no-console -- CLI ops script */
import { createSpFetch } from '@/lib/sp/spFetch';
import { getAppConfig } from '@/lib/env';

/**
 * Standardized SharePoint fetch factory for CLI tools.
 * Integrates with the app's native spFetch to ensure consistent retries, 
 * telemetry, and error handling.
 * 
 * Requirements:
 * - process.env.VITE_SP_TOKEN or process.env.SP_TOKEN
 * - process.env.VITE_SP_SITE_URL or process.env.SP_SITE_URL
 */
export function createCliSpFetch(token?: string, siteUrl?: string) {
  const config = getAppConfig();
  
  const effectiveToken = token || process.env.VITE_SP_TOKEN || process.env.SP_TOKEN;
  const effectiveSiteUrl = siteUrl || process.env.VITE_SP_SITE_URL || process.env.SP_SITE_URL;
  const baseUrl = effectiveSiteUrl ? `${effectiveSiteUrl}/_api/web` : '';

  if (!effectiveToken && !process.env.VITE_SKIP_SHAREPOINT) {
    console.warn('[CLI] VITE_SP_TOKEN is missing. Requests will likely fail.');
  }

  return createSpFetch({
    acquireToken: async () => effectiveToken || null,
    baseUrl: baseUrl,
    config: config as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    retrySettings: {
      maxAttempts: Number(config.VITE_SP_RETRY_MAX || 4),
      baseDelay: Number(config.VITE_SP_RETRY_BASE_MS || 400),
      capDelay: Number(config.VITE_SP_RETRY_MAX_DELAY_MS || 5000),
    },
    debugEnabled: !!config.VITE_AUDIT_DEBUG,
    spSiteLegacy: config.VITE_SP_SITE_RELATIVE,
  });
}
