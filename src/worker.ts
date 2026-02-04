/**
 * Cloudflare Workers - Complete passthrough (diagnostic)
 * Temporarily reverting to verify HTML delivery
 */

export default {
  async fetch(request: Request): Promise<Response> {
    return fetch(request);
  },
};
