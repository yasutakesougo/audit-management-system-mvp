/**
 * fetchSp — SharePoint fetch 互換ラッパー
 *
 * @deprecated Phase 3-B で spClient.spFetch 直利用に移行予定。
 *   新規コードでは import { useSP } from '@/lib/spClient' を使うこと。
 *
 * 内部実装は spFetch (createSpFetch) に完全委譲し、
 * リトライ・mock・認証を SSOT で処理する。
 * throwOnError: false により、従来通り Response を返す。
 * (呼び出し側が response.ok を自前でチェックする既存パターンを維持)
 */
import { acquireSpAccessToken, getSharePointScopes } from '@/lib/msal';
import { ensureConfig } from '@/lib/sp/config';
import { createNormalizePath, createSpFetch } from '@/lib/sp/spFetch';
import { getAppConfig, readEnv, type EnvRecord } from '@/lib/env';

// ── Singleton (lazily initialized) ──────────────────────────────────────────

let _cachedFetch: ((path: string, init?: RequestInit) => Promise<Response>) | null = null;

function getOrCreateSpFetch(): (path: string, init?: RequestInit) => Promise<Response> {
  if (_cachedFetch) return _cachedFetch;

  const { baseUrl } = ensureConfig();
  const config = getAppConfig();
  const envRecord: EnvRecord = { ...config } as EnvRecord;
  const spSiteLegacy = readEnv('VITE_SP_SITE', '', envRecord);

  const retrySettings = {
    maxAttempts: Number(config.VITE_SP_RETRY_MAX) || 4,
    baseDelay: Number(config.VITE_SP_RETRY_BASE_MS) || 400,
    capDelay: Number(config.VITE_SP_RETRY_MAX_DELAY_MS) || 5000,
  } as const;

  const debugEnabled = !!config.VITE_AUDIT_DEBUG;

  const normalizePath = createNormalizePath(envRecord, spSiteLegacy, baseUrl);

  const scopes = getSharePointScopes();
  const acquireToken = async (): Promise<string | null> => {
    try {
      return await acquireSpAccessToken(scopes.length ? scopes : getSharePointScopes());
    } catch {
      return null;
    }
  };

  const rawSpFetch = createSpFetch({
    acquireToken,
    baseUrl,
    config: envRecord,
    retrySettings,
    debugEnabled,
    spSiteLegacy,
    throwOnError: false, // ← 互換: Response をそのまま返す
  });

  // spClient と同じ normalizePath → rawSpFetch パイプライン
  _cachedFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
    return rawSpFetch(normalizePath(path), init);
  };

  return _cachedFetch;
}

// ── Public API (signature unchanged) ────────────────────────────────────────

/**
 * @deprecated Use `useSP().spFetch()` or `createSpClient()` instead.
 *
 * SharePoint REST API fetch。フルURL・相対パスの両方を受け付ける。
 * リトライ (429/5xx)・mock (dev/demo)・認証は createSpFetch に委譲。
 * !response.ok 時は例外を投げず、呼び出し側で response.ok をチェックする。
 */
export const fetchSp = async (url: string, init: RequestInit = {}): Promise<Response> => {
  const spFetch = getOrCreateSpFetch();
  return spFetch(url, init);
};
