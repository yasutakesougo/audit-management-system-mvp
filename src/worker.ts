/**
 * Cloudflare Workers custom handler for Assets
 * SPA fallback + COOP header for MSAL popup authentication
 */

interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // API routes - pass through
    if (url.pathname.startsWith('/api')) {
      return env.ASSETS.fetch(request);
    }

    // Static files (has file extension) - serve as-is (no rewrites)
    if (url.pathname.includes('.')) {
      const assetResponse = await env.ASSETS.fetch(request);
      const headers = new Headers(assetResponse.headers);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      return new Response(assetResponse.body, {
        status: assetResponse.status,
        headers,
      });
    }

    // SPA routes (no extension) - always return index.html
    const indexRequest = new Request(new URL('/index.html', url), request);
    const indexResponse = await env.ASSETS.fetch(indexRequest);

    const headers = new Headers(indexResponse.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    headers.set('Cache-Control', 'no-store, must-revalidate');
    headers.set('Content-Type', 'text/html; charset=UTF-8');

    return new Response(indexResponse.body, {
      status: indexResponse.status,
      headers,
    });
  },
};
