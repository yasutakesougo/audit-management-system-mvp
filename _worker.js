/**
 * Cloudflare Workers custom handler for Assets
 * Adds COOP header to HTML responses for MSAL popup authentication
 */
export default {
  async fetch(request, env) {
    // Serve static assets via Workers Assets
    const response = await env.ASSETS.fetch(request);

    // Only modify HTML responses
    const contentType = response.headers.get('content-type') || '';
    const isHtml = contentType.includes('text/html');

    if (!isHtml) {
      return response;
    }

    // Add COOP header for MSAL popup support
    const headers = new Headers(response.headers);
    headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    headers.set('Cache-Control', 'public, max-age=0, must-revalidate');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
