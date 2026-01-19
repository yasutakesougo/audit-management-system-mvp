/**
 * Cloudflare Workers custom handler for Assets
 * - SPA fallback: /dashboard-like paths return index.html on 404
 * - COOP header: MSAL popup support for authentication
 */

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

const toIndexRequest = (request: Request) => {
  // 絶対URLで Request を作成（相対URLだと例外になる）
  const indexUrl = new URL('/index.html', request.url);
  return new Request(indexUrl.toString(), {
    method: 'GET',
    headers: request.headers,
  });
};

const isHtmlRequest = (req: Request) => {
  const accept = req.headers.get('Accept') || '';
  const dest = req.headers.get('Sec-Fetch-Dest') || '';
  return accept.includes('text/html') || dest === 'document';
};

const shouldSpaFallback = (pathname: string) => {
  if (pathname.startsWith('/assets/')) return false;
  if (pathname === '/favicon.ico') return false;
  return !pathname.includes('.');
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    let res: Response;

    // HEAD は素通し
    if (request.method === 'HEAD') {
      return env.ASSETS.fetch(request);
    }

    try {
      res = await env.ASSETS.fetch(request);
    } catch {
      // ASSETS.fetch 自体が落ちるならここ
      return new Response('Worker ASSETS.fetch failed', { status: 500 });
    }

    // 404 かつ SPA対象パスなら index.html を返す
    if (
      res.status === 404 &&
      request.method === 'GET' &&
      isHtmlRequest(request) &&
      shouldSpaFallback(url.pathname)
    ) {
      try {
        res = await env.ASSETS.fetch(toIndexRequest(request));
      } catch {
        // フォールバック失敗時もエラーを return（500投げない）
        return new Response('SPA fallback failed', { status: 500 });
      }
    }

    // HTML判定で COOP を付与
    const accept = request.headers.get('accept') || '';
    const dest = request.headers.get('sec-fetch-dest') || '';
    const wantsHtml = accept.includes('text/html') || dest === 'document';

    if (!wantsHtml) return res;

    const headers = new Headers(res.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    // HTML は キャッシュ無効化
    headers.set('Cache-Control', 'no-store');

    return new Response(res.body, { status: res.status, headers });
  },
};
