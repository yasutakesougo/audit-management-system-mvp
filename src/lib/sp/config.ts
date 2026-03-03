/**
 * SharePoint Config — 接続設定の解決・検証
 *
 * spClient.ts から抽出。ensureConfig + 関連ヘルパー。
 */
import { getAppConfig, isE2eMsalMockEnabled, readBool, readEnv, shouldSkipLogin, skipSharePoint, type EnvRecord } from '@/lib/env';

const FALLBACK_SP_RESOURCE = 'https://example.sharepoint.com';
const FALLBACK_SP_SITE_RELATIVE = '/sites/demo';

const sanitizeEnvValue = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const shouldBypassSharePointConfig = (envOverride?: EnvRecord): boolean => {
  // Respect explicit SharePoint overrides even when test/demo flags are set
  if (envOverride && ('VITE_SP_RESOURCE' in envOverride || 'VITE_SP_SITE_RELATIVE' in envOverride || 'VITE_SP_SITE' in envOverride || 'VITE_SP_SITE_URL' in envOverride)) {
    return false;
  }

  // Force SharePoint even in E2E/mock contexts when explicitly requested (e.g., Playwright stub mode)
  const isForceSp = readBool('VITE_FORCE_SHAREPOINT', false, envOverride);
  if (isForceSp) {
    return false;
  }

  if (isE2eMsalMockEnabled(envOverride)) {
    return true;
  }
  if (readBool('VITE_E2E', false, envOverride)) {
    return true;
  }
  if (skipSharePoint(envOverride)) {
    return true;
  }
  if (shouldSkipLogin(envOverride)) {
    return true;
  }
  if (typeof process !== 'undefined' && process.env?.PLAYWRIGHT_TEST === '1') {
    return true;
  }
  return false;
};

export const normalizeSiteRelative = (value: string): string => {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return prefixed.replace(/\/+$/, '');
};

export const normalizeResource = (value: string): string => value.trim().replace(/\/+$/, '');

export function ensureConfig(envOverride?: { VITE_SP_RESOURCE?: string; VITE_SP_SITE_RELATIVE?: string; VITE_SP_SITE?: string; VITE_SP_SITE_URL?: string }) {
  const overrideRecord = envOverride as EnvRecord | undefined;
  const hasExplicitOverride = envOverride !== undefined;

  const _pickSite = () => {
    const primary = readEnv('VITE_SP_SITE_RELATIVE', '', overrideRecord).trim();
    if (primary) return primary;
    const legacy = readEnv('VITE_SP_SITE', '', overrideRecord).trim();
    return legacy;
  };

  const isPlaceholder = (s: string) => {
    const normalized = (s ?? '').trim();
    if (!normalized) return true;

    const lower = normalized.toLowerCase();
    if (normalized.includes('<') || normalized.includes('__')) return true;
    if (/<[^>]+>/.test(normalized)) return true;
    if (lower.includes('fill') || lower.includes('your')) return true;

    return false;
  };

  const validateAndNormalize = (resourceRaw: string, siteRaw: string) => {
    const overrideResource = sanitizeEnvValue(resourceRaw);
    const overrideSiteRel = sanitizeEnvValue(siteRaw);

    if (isPlaceholder(overrideResource) || isPlaceholder(overrideSiteRel)) {
      throw new Error([
        'SharePoint 接続設定が未完了です。',
        'VITE_SP_RESOURCE 例: https://contoso.sharepoint.com（末尾スラッシュ不要）',
        'VITE_SP_SITE_RELATIVE 例: /sites/AuditSystem（先頭スラッシュ必須・末尾不要）',
        '`.env` を実値で更新し、開発サーバーを再起動してください。'
      ].join('\n'));
    }

    let overrideUrl: URL;
    try {
      overrideUrl = new URL(overrideResource);
    } catch {
      throw new Error(`VITE_SP_RESOURCE の形式が不正です: ${overrideResource}`);
    }

    if (overrideUrl.protocol !== 'https:' || !/\.sharepoint\.com$/i.test(overrideUrl.hostname)) {
      throw new Error(`VITE_SP_RESOURCE の形式が不正です: ${overrideResource}`);
    }

    const siteCandidate = normalizeSiteRelative(overrideSiteRel);
    if (!siteCandidate.startsWith('/sites/') && !siteCandidate.startsWith('/teams/')) {
      throw new Error(`VITE_SP_SITE_RELATIVE の形式が不正です: ${overrideSiteRel}`);
    }

    const resource = normalizeResource(overrideUrl.origin);
    const siteRel = siteCandidate;
    return { resource, siteRel, baseUrl: `${resource}${siteRel}/_api/web` };
  };

  if (hasExplicitOverride) {
    return validateAndNormalize(
      envOverride?.VITE_SP_RESOURCE ?? '',
      envOverride?.VITE_SP_SITE_RELATIVE ?? envOverride?.VITE_SP_SITE ?? ''
    );
  }

  if (shouldBypassSharePointConfig(overrideRecord)) {
    // E2E/demo/mock/skip-login 等では SharePoint を外部に出さない
    return { resource: '', siteRel: '', baseUrl: '' };
  }

  const baseConfig = getAppConfig();
  const config = envOverride ? { ...baseConfig, ...(envOverride as object) } as Record<string, unknown> : baseConfig;

  if (config.VITE_E2E) {
    const resource = FALLBACK_SP_RESOURCE;
    const siteRel = FALLBACK_SP_SITE_RELATIVE;
    return { resource, siteRel, baseUrl: `${resource}${siteRel}/_api/web` };
  }

  const rawResource = sanitizeEnvValue((config as Record<string, unknown>).VITE_SP_RESOURCE ?? '');
  const rawSiteRel = sanitizeEnvValue(
    (config as Record<string, unknown>).VITE_SP_SITE_RELATIVE ??
      (config as Record<string, unknown>).VITE_SP_SITE ??
      ''
  );

  return validateAndNormalize(rawResource, rawSiteRel);
}
