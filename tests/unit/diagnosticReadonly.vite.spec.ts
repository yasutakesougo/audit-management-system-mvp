// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { request } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createServer, loadConfigFromFile, preview, type Plugin, type ViteDevServer, type PreviewServer } from 'vite';

describe.each(['dev', 'preview'] as const)('diagnostic read-only proxy on Vite %s', (host) => {
  let directory: string;
  let server: ViteDevServer | PreviewServer;
  let port: number;
  let upstream: ReturnType<typeof vi.fn>;
  const target = '/api/sp-proxy-readonly?url=' + encodeURIComponent('https://fixture.invalid/sites/test/_api/web/lists');
  const call = (method: string, headers: Record<string, string> = {}) => new Promise<{ status: number; headers: Record<string, unknown>; body: string }>((resolveResponse, reject) => {
    const req = request({ hostname: '127.0.0.1', port, path: target, method, headers }, (res) => {
      let body = '';
      res.setEncoding('utf8'); res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => resolveResponse({ status: res.statusCode!, headers: res.headers, body }));
    });
    req.on('error', reject); req.end();
  });

  beforeEach(async () => {
    vi.stubEnv('VITE_SP_RESOURCE', 'https://fixture.invalid');
    vi.stubEnv('VITE_SP_SITE_RELATIVE', '/sites/test');
    upstream = vi.fn().mockImplementation(async () => new Response('{"value":[]}', { headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', upstream);
    directory = await mkdtemp(join(tmpdir(), 'diagnostic-readonly-host-'));
    await writeFile(join(directory, 'index.html'), '<html>synthetic fixture</html>');
    // Load the real config to verify that the middleware is actually wired.
    const loaded = await loadConfigFromFile({ command: 'serve', mode: 'test' }, resolve('vite.config.ts'));
    const plugin = (loaded!.config.plugins as Plugin[]).find((p) => p.name === 'diagnostic-readonly-proxy');
    expect(plugin).toBeDefined();
    const options = { root: directory, configFile: false as const, plugins: [plugin!], logLevel: 'silent' as const, build: { outDir: '.' } };
    if (host === 'dev') {
      const dev = await createServer({ ...options, server: { host: '127.0.0.1', port: 0 }, optimizeDeps: { noDiscovery: true, include: [] } });
      await dev.listen(); server = dev;
    } else {
      server = await preview({ ...options, preview: { host: '127.0.0.1', port: 0 } });
    }
    port = (server.httpServer!.address() as AddressInfo).port;
  });
  afterEach(async () => {
    if (server && 'close' in server) await server.close();
    else if (server) await new Promise<void>((done) => server.httpServer.close(() => done()));
    if (directory) await rm(directory, { recursive: true, force: true });
    vi.unstubAllGlobals(); vi.unstubAllEnvs();
  });

  it('rejects all writes and overrides before upstream access', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'MERGE']) {
      const response = await call(method);
      expect(response.status).toBe(405);
      expect(response.headers['x-diagnostic-readonly-proxy']).toBe('1');
    }
    for (const method of ['GET', 'HEAD', 'OPTIONS']) expect((await call(method, { 'X-HTTP-Method': 'MERGE' })).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
  it('allows authenticated reads and OPTIONS without falling through to SPA HTML', async () => {
    for (const method of ['GET', 'HEAD']) {
      const response = await call(method, { Authorization: 'Bearer synthetic-token' });
      expect(response.status).toBe(200);
      expect(response.headers['x-diagnostic-readonly-proxy']).toBe('1');
      if (method === 'GET') expect(JSON.parse(response.body)).toEqual({ value: [] });
    }
    expect((await call('OPTIONS')).status).toBe(204);
    expect(upstream).toHaveBeenCalledTimes(2);
    expect(upstream.mock.calls.map(([req]) => req.method)).toEqual(['GET', 'HEAD']);
    expect(upstream.mock.calls.every(([req]) => req.url === 'https://fixture.invalid/sites/test/_api/web/lists')).toBe(true);
  });
  it('requires authentication before upstream access', async () => {
    expect((await call('GET')).status).toBe(401);
    expect(upstream).not.toHaveBeenCalled();
  });
});
