#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildCspConfig } from './csp-headers.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const distDir = resolve(projectRoot, 'dist');
const reportDirEnv = process.env.CSP_REPORT_DIR || 'csp-reports';
const reportDir = resolve(projectRoot, reportDirEnv);

if (!existsSync(distDir)) {
  console.error('[CSP] dist/ not found. Run `npm run build` before `preview:csp`.');
  process.exit(1);
}

mkdirSync(reportDir, { recursive: true });
const reportFile = resolve(reportDir, 'violations.ndjson');
if (!process.env.CSP_REPORT_APPEND && existsSync(reportFile)) {
  rmSync(reportFile);
}
if (!existsSync(reportFile)) {
  writeFileSync(reportFile, '');
}

const collectorPort = process.env.CSP_PORT || '8787';
const collectorPrefix = process.env.CSP_PREFIX || '/__csp__';

const sharedEnv = {
  ...process.env,
  CSP_PORT: collectorPort,
  CSP_PREFIX: collectorPrefix,
  CSP_REPORT_DIR: reportDir,
  CSP_PREVIEW_ORIGIN: process.env.CSP_PREVIEW_ORIGIN || 'http://localhost:4174',
};

if (!sharedEnv.CSP_PREVIEW_PORT) {
  sharedEnv.CSP_PREVIEW_PORT = '4174';
}

if (!sharedEnv.CSP_COLLECTOR_ORIGIN) {
  sharedEnv.CSP_COLLECTOR_ORIGIN = `http://localhost:${collectorPort}`;
}

const { headerName: cspHeaderName, headerValue: cspHeaderValue, reportToValue } = buildCspConfig({
  siteUrl: sharedEnv.VITE_SP_SITE_URL || sharedEnv.VITE_SP_BASE_URL,
  spResource: sharedEnv.VITE_SP_RESOURCE,
  spBaseUrl: sharedEnv.VITE_SP_BASE_URL,
  collectorOrigin: sharedEnv.CSP_COLLECTOR_ORIGIN,
  collectorPrefix,
  collectorPort,
  enforce: sharedEnv.CSP_ENFORCE === '1',
  disabled: sharedEnv.CSP_DISABLE === '1',
});

const collector = spawn('node', [resolve(projectRoot, 'scripts/csp-report-server.mjs')], {
  cwd: projectRoot,
  env: sharedEnv,
  stdio: 'inherit',
});

let server;

collector.on('exit', (code, signal) => {
  if ((typeof code === 'number' && code !== 0) || signal) {
    console.error(`[CSP] collector exited unexpectedly (${code ?? signal ?? 'unknown'})`);
    if (server) {
      server.close(() => process.exit(code ?? 1));
    } else {
      process.exit(code ?? 1);
    }
  }
});

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

const baseHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Cross-Origin-Embedder-Policy': 'unsafe-none',
};

if (cspHeaderName && cspHeaderValue) {
  baseHeaders[cspHeaderName] = cspHeaderValue;
  if (reportToValue) {
    baseHeaders['Report-To'] = reportToValue;
  }
}

server = createServer((req, res) => {
  const handleRequest = () => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/__health') {
      res.writeHead(200, {
        ...baseHeaders,
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
      }).end('ok');
      return;
    }
    const rawPath = decodeURIComponent(url.pathname || '/');
    const normalizedPath = rawPath.endsWith('/') ? `${rawPath}index.html` : rawPath;
    const absoluteRequested = resolve(distDir, `.${normalizedPath}`);

    if (!absoluteRequested.startsWith(distDir)) {
      res.writeHead(403, baseHeaders).end('Forbidden');
      return;
    }

    let finalPath = absoluteRequested;
    try {
      const stats = statSync(absoluteRequested);
      if (stats.isDirectory()) {
        finalPath = join(absoluteRequested, 'index.html');
      }
    } catch {
      finalPath = resolve(distDir, 'index.html');
    }

    const extension = extname(finalPath);
    const contentType = MIME_TYPES[extension] || 'application/octet-stream';
    const headers = {
      ...baseHeaders,
      'Content-Type': contentType,
      'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=3600',
    };

    if (req.method === 'HEAD') {
      res.writeHead(200, headers).end();
      return;
    }

    const stream = createReadStream(finalPath);
    stream.on('error', (error) => {
      console.error('[CSP] preview read error', error);
      if (!res.headersSent) {
        res.writeHead(500, headers);
      }
      res.end('Internal Server Error');
    });
    res.writeHead(200, headers);
    stream.pipe(res);
  };

  try {
    handleRequest();
  } catch (error) {
    console.error('[CSP] preview handler error', error);
    res.writeHead(500, baseHeaders).end('Internal Server Error');
  }
});

const previewHost = '127.0.0.1';
const previewPort = Number(sharedEnv.CSP_PREVIEW_PORT || 4173);

server.listen(previewPort, previewHost, () => {
  console.log(`[CSP] preview listening on http://${previewHost}:${previewPort}/`);
});

const shutdown = (signal = 'SIGTERM') => {
  const terminate = () => {
    if (!collector.killed && collector.exitCode === null) {
      collector.kill(signal);
    }
    process.exit();
  };

  if (server) {
    server.close(terminate);
  } else {
    terminate();
  }
};

['SIGINT', 'SIGTERM', 'SIGHUP'].forEach((signal) => {
  process.on(signal, () => shutdown(signal));
});
