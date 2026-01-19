/**
 * Cloudflare Workers custom handler for Assets
 * - Rely on not_found_handling = "single-page-application" from wrangler.toml
 * - Only attach COOP header to HTML responses
 */

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // HEAD は素通し
    if (request.method === 'HEAD') {
      return env.ASSETS.fetch(request);
    }

    let res: Response;

    try {
      res = await env.ASSETS.fetch(request);
    } catch {
      return new Response('Worker error', { status: 500 });
    }

    // 3xx リダイレクトは加工しない
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
  },
};
