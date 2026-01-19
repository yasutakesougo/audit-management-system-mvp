/**
 * Cloudflare Workers custom handler for Assets
 * - SPA fallback: /dashboard-like paths return / on 404
 * - COOP header: MSAL popup support for authentication
 */

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

const toSpaEntryRequest = (request: Request) => {
  // フォールバック先は / に固定（/index.html は 307 リダイレクトされる可能性がある）
  const url = new URL('/', request.url);
  return new Request(url.toString(), {
    method: 'GET',
    headers: request.headers,
  });
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // HEAD は素通し
    if (request.method === 'HEAD') {
      return env.ASSETS.fetch(request);
    }

    try {
      let res = await env.ASSETS.fetch(request);

      // SPA fallback: 404 は / を返す
      if (res.status === 404 && request.method === 'GET') {
        res = await env.ASSETS.fetch(toSpaEntryRequest(request));
      }

      // 3xx リダイレクトは加工しない（body がないため）
      if (res.status >= 300 && res.status < 400) {
        return res;
      }

      // HTML判定で COOP を付与
      const accept = request.headers.get('accept') || '';
      const dest = request.headers.get('sec-fetch-dest') || '';
      const wantsHtml = accept.includes('text/html') || dest === 'document';

      if (!wantsHtml) return res;

      const headers = new Headers(res.headers);
      headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
      headers.set('Cache-Control', 'no-store');

      return new Response(res.body, { status: res.status, headers });
    } catch {
      return new Response('Worker error', { status: 500 });
    }
  },
};
