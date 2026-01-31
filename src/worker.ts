/**
 * Cloudflare Workers custom handler for Assets
 * Adds COOP header to HTML responses for MSAL popup authentication
 */

interface Env {
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Serve static assets via Workers Assets
    const response = await env.ASSETS.fetch(request);

    // Only modify HTML responses
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return response;
    }

    // Add COOP header for MSAL popup support
    const headers = new Headers(response.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate');

    return new Response(response.body, {
      status: response.status,
      headers,
    });
  },
};
