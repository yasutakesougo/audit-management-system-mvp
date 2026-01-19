/**
 * Cloudflare Workers custom handler for Assets
 * - Attaches COOP header for MSAL popup authentication
 * - Relies on wrangler.toml [assets] binding for SPA fallback
 */

interface Env {
  ASSETS?: { fetch: (request: Request) => Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Guard: ASSETS binding must be present
    if (!env.ASSETS?.fetch) {
      return new Response(
        'ASSETS binding is missing. Check wrangler.toml [assets] binding = "ASSETS".',
        { status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' } }
      );
    }

    let res: Response;
    try {
      res = await env.ASSETS.fetch(request);
    } catch {
      return new Response('ASSETS.fetch failed', { status: 500 });
    }

    // Skip modification for HEAD, 3xx, or non-HTML
    if (request.method === 'HEAD') return res;
    if (res.status >= 300 && res.status < 400) return res;

    const accept = request.headers.get('accept') || '';
    const dest = request.headers.get('sec-fetch-dest') || '';
    const isHtml = accept.includes('text/html') || dest === 'document';

    if (!isHtml) return res;

    // Attach COOP header for HTML responses
    const headers = new Headers(res.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    headers.set('Cache-Control', 'no-store');

    return new Response(res.body, { status: res.status, headers });
  },
};
