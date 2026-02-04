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
    const acceptsHtml = request.headers.get('accept')?.includes('text/html');

    // API routes - pass through
    if (url.pathname.startsWith('/api')) {
      return env.ASSETS.fetch(request);
    }

    // Static files (has file extension) - serve as-is (no rewrites)
    if (url.pathname.includes('.')) {
      return env.ASSETS.fetch(request);
    }

    // SPA routes (no extension) - always return index.html
    if (acceptsHtml || !url.pathname.includes('.')) {
      const indexRequest = new Request(new URL('/index.html', url), request);
      const indexResponse = await env.ASSETS.fetch(indexRequest);
      const redirectLocation = indexResponse.headers.get('location');
      const resolvedResponse =
        indexResponse.status >= 300 && indexResponse.status < 400 && redirectLocation
          ? await env.ASSETS.fetch(new Request(new URL(redirectLocation, url), request))
          : indexResponse;
      const html = await resolvedResponse.text();

      const headers = new Headers(resolvedResponse.headers);
      headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
      headers.set('Cache-Control', 'no-store, must-revalidate');
      headers.set('Content-Type', 'text/html; charset=UTF-8');
      headers.delete('Location');

      return new Response(html, {
        status: 200,
        headers,
      });
    }

    return env.ASSETS.fetch(request);
  },
};
