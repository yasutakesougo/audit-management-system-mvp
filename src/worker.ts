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

    // Static files (has file extension) - serve as-is
    if (url.pathname.includes('.')) {
      return env.ASSETS.fetch(request);
    }

    // SPA routes (no extension) - always return index.html with COOP header
    const indexRequest = new Request(new URL('/index.html', url), request);
    const indexResponse = await env.ASSETS.fetch(indexRequest);
    
    const headers = new Headers(indexResponse.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate');

    return new Response(indexResponse.body, {
      status: 200,
      headers,
    });
  },
};
