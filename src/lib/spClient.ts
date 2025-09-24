// NOTE: Avoid path alias here to keep ts-jest / vitest resolution simple without extra config
import { useAuth } from '../auth/useAuth';
import { useMemo } from 'react';

export function ensureConfig(envOverride?: { VITE_SP_RESOURCE?: string; VITE_SP_SITE_RELATIVE?: string }) {
  // Allow tests to pass override values since Vite inlines import.meta.env at build time.
  const rawResource = (envOverride?.VITE_SP_RESOURCE ?? (import.meta as any).env?.VITE_SP_RESOURCE ?? '').trim();
  const rawSiteRel  = (envOverride?.VITE_SP_SITE_RELATIVE ?? (import.meta as any).env?.VITE_SP_SITE_RELATIVE ?? '').trim();
  const isPlaceholder = (s: string) => !s || /<yourtenant>|<SiteName>/i.test(s) || s === '__FILL_ME__';
  if (isPlaceholder(rawResource) || isPlaceholder(rawSiteRel)) {
    throw new Error([
      'SharePoint 接続設定が未完了です。',
      'VITE_SP_RESOURCE 例: https://contoso.sharepoint.com（末尾スラッシュ不要）',
      'VITE_SP_SITE_RELATIVE 例: /sites/AuditSystem（先頭スラッシュ必須・末尾不要）',
      '`.env` を実値で更新し、開発サーバーを再起動してください。'
    ].join('\n'));
  }
  const resourceCandidate = rawResource.replace(/\/+$/, '');
  if (!/^https:\/\/.+\.sharepoint\.com$/i.test(resourceCandidate)) {
    throw new Error(`VITE_SP_RESOURCE の形式が不正です: ${rawResource}`);
  }
  const resource = resourceCandidate;
  const siteRel0 = rawSiteRel.startsWith('/') ? rawSiteRel : `/${rawSiteRel}`;
  const siteRel = siteRel0.replace(/\/+$/, '');
  return { resource, siteRel, baseUrl: `${resource}${siteRel}/_api/web` };
}

/**
 * テスト可能なクライアントファクトリ（React Hook に依存しない）
 * - acquireToken: トークン取得関数（MSAL由来を想定）
 * - baseUrl: 例) https://contoso.sharepoint.com/sites/Audit/_api/web
 */
export function createSpClient(acquireToken: () => Promise<string | null>, baseUrl: string) {
  const debugEnabled = import.meta.env.VITE_AUDIT_DEBUG === '1';
  function dbg(...a: unknown[]) { if (debugEnabled) console.debug('[spClient]', ...a); }
  const spFetch = async (path: string, init: RequestInit = {}): Promise<Response> => {
    const token1 = await acquireToken();
    if (debugEnabled && (globalThis as any).__TOKEN_METRICS__) {
      const m = (globalThis as any).__TOKEN_METRICS__;
      dbg('token metrics snapshot', m);
    }
    if (!token1) {
      throw new Error([
        'SharePoint のアクセストークン取得に失敗しました。',
        '対処:',
        ' - 右上からサインイン',
        ' - Entra で SharePoint 委任権限 (AllSites.Read/Manage) に管理者同意',
        ' - `.env` の VITE_SP_RESOURCE / VITE_SP_SITE_RELATIVE を確認'
      ].join('\n'));
    }

    const doFetch = async (token: string) => {
      const url = `${baseUrl}${path}`;
      const headers = new Headers(init.headers || {});
      headers.set('Authorization', `Bearer ${token}`);
      headers.set('Accept', 'application/json;odata=nometadata');
      if (init.method === 'POST' || init.method === 'PUT' || init.method === 'PATCH' || init.method === 'MERGE') {
        headers.set('Content-Type', 'application/json;odata=nometadata');
      }
      if (import.meta.env.DEV) console.debug('[SPFetch] URL:', url);
      return fetch(url, { ...init, headers });
    };

    let response = await doFetch(token1);

    // Retry transient (throttle/server) BEFORE auth refresh, but only if not 401/403.
    const maxAttempts = Number(import.meta.env.VITE_SP_RETRY_MAX || '4');
    const baseDelay = Number(import.meta.env.VITE_SP_RETRY_BASE_MS || '400');
    const capDelay = Number(import.meta.env.VITE_SP_RETRY_MAX_DELAY_MS || '5000');
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const computeBackoff = (attempt: number) => {
      const expo = Math.min(capDelay, baseDelay * Math.pow(2, attempt - 1));
      const jitter = Math.random() * expo; // full jitter
      return Math.round(jitter);
    };
    let attempt = 1;
    while (!response.ok && [429,503,504].includes(response.status) && attempt < maxAttempts) {
      let waitMs: number | null = null;
      const ra = response.headers.get('Retry-After');
      if (ra) {
        const sec = Number(ra);
        if (!isNaN(sec) && sec > 0) {
          waitMs = sec * 1000;
        } else {
          const ts = Date.parse(ra);
            if (!isNaN(ts)) waitMs = Math.max(0, ts - Date.now());
        }
      }
      if (waitMs == null) waitMs = computeBackoff(attempt);
      if (debugEnabled) {
        console.warn('[spRetry]', JSON.stringify({ phase: 'single', status: response.status, nextAttempt: attempt + 1, waitMs }));
      }
      await sleep(waitMs);
      attempt += 1;
      response = await doFetch(token1);
    }

    if (!response.ok && (response.status === 401 || response.status === 403)) {
      const token2 = await acquireToken();
      if (token2 && token2 !== token1) {
        response = await doFetch(token2);
      }
    }

    if (!response.ok) {
      const errorBody = await response.text();
      let msg = `APIリクエストに失敗しました (${response.status} ${response.statusText})`;
      try {
        const j = JSON.parse(errorBody); msg = j['odata.error']?.message?.value || msg;
      } catch {
        msg = `${msg}\n${errorBody.slice(0,500)}`;
      }
      if (response.status === 401 || response.status === 403) msg += '\n対処: 権限/同意と .default スコープを確認してください。';
      throw new Error(msg);
    }
    return response;
  };

  const getListItemsByTitle = async <T>(
    listTitle: string,
    select?: string[],
    filter?: string,
    orderby?: string,
    top: number = 500
  ): Promise<T[]> => {
    const params = new URLSearchParams();
    if (select?.length) params.append('$select', select.join(','));
    if (filter) params.append('$filter', filter);
    if (orderby) params.append('$orderby', orderby);
    params.append('$top', String(top));
    const path = `/lists/getbytitle('${encodeURIComponent(listTitle)}')/items?${params.toString()}`;
    const res = await spFetch(path);
    const data = await res.json();
    return data.value || [];
  };

  const addListItemByTitle = async <TBody extends object, TResult = unknown>(
    listTitle: string,
    body: TBody
  ): Promise<TResult> => {
    const path = `/lists/getbytitle('${encodeURIComponent(listTitle)}')/items`;
    const res = await spFetch(path, { method: 'POST', body: JSON.stringify(body) });
    return await res.json() as TResult;
  };

  // $batch 投稿ヘルパー (429/503/504 リトライ対応)
  const postBatch = async (batchBody: string, boundary: string): Promise<Response> => {
    const apiRoot = baseUrl.replace(/\/web\/?$/, '');
    const maxAttempts = Number(import.meta.env.VITE_SP_RETRY_MAX || '4');
    const baseDelay = Number(import.meta.env.VITE_SP_RETRY_BASE_MS || '400');
    const capDelay = Number(import.meta.env.VITE_SP_RETRY_MAX_DELAY_MS || '5000');
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const computeBackoff = (attempt: number) => {
      const expo = Math.min(capDelay, baseDelay * Math.pow(2, attempt - 1));
      const jitter = Math.random() * expo; // full jitter
      return Math.round(jitter);
    };
    let attempt = 1;
    while (true) {
      const token = await acquireToken();
      if (!token) throw new Error('SharePoint のアクセストークン取得に失敗しました。');
      const headers = new Headers({
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Content-Type': `multipart/mixed; boundary=${boundary}`
      });
      const res = await fetch(`${apiRoot}/$batch`, { method: 'POST', headers, body: batchBody });
      // E2E instrumentation (non-production impact): expose attempt count & last URL for debugging
      if (typeof window !== 'undefined') {
        try {
          (window as any).__E2E_BATCH_URL__ = `${apiRoot}/$batch`;
          (window as any).__E2E_BATCH_ATTEMPTS__ = ((window as any).__E2E_BATCH_ATTEMPTS__ || 0) + 1;
        } catch {}
      }
      if (res.ok) return res;
      if ([429,503,504].includes(res.status) && attempt < maxAttempts) {
        let waitMs: number | null = null;
        const ra = res.headers.get('Retry-After');
        if (ra) {
          const sec = Number(ra);
          if (!isNaN(sec) && sec > 0) waitMs = sec * 1000; else {
            const ts = Date.parse(ra); if (!isNaN(ts)) waitMs = Math.max(0, ts - Date.now());
          }
        }
        if (waitMs == null) waitMs = computeBackoff(attempt);
  if (debugEnabled) console.warn('[spRetry]', JSON.stringify({ phase: 'batch', status: res.status, nextAttempt: attempt + 1, waitMs }));
        await sleep(waitMs);
        attempt += 1;
        continue;
      }
      const text = await res.text();
      let msg = `Batch API に失敗しました (${res.status} ${res.statusText})`;
      try { const j = JSON.parse(text); msg = j['odata.error']?.message?.value || msg; } catch {}
      const guid = res.headers.get('sprequestguid') || res.headers.get('request-id');
      if (guid) msg += `\nSPRequestGuid: ${guid}`;
      throw new Error(msg);
    }
  };

  return { spFetch, getListItemsByTitle, addListItemByTitle, postBatch };
}

export const useSP = () => {
  const { acquireToken } = useAuth();
  const cfg = useMemo(() => ensureConfig(), []);
  const client = useMemo(() => createSpClient(acquireToken, cfg.baseUrl), [acquireToken, cfg.baseUrl]);
  const { spFetch, getListItemsByTitle, addListItemByTitle, postBatch } = client;
  return { spFetch, getListItemsByTitle, addListItemByTitle, postBatch };
};

// test-only export (intentionally non-exported in production bundles usage scope)
export const __test__ = { ensureConfig };

// IDE 補完用に公開フック型を輸出
export type UseSP = ReturnType<typeof useSP>;
