import http from 'node:http';
import { appendFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = process.env.CSP_PORT ? Number(process.env.CSP_PORT) : 8787;
const PREFIX = process.env.CSP_PREFIX || '/__csp__';
const REPORT_DIR = process.env.CSP_REPORT_DIR;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const resolvedReportDir = REPORT_DIR ? resolve(projectRoot, REPORT_DIR) : null;
const reportFile = resolvedReportDir ? resolve(resolvedReportDir, 'violations.ndjson') : null;

if (resolvedReportDir) {
  mkdirSync(resolvedReportDir, { recursive: true });
  if (!process.env.CSP_REPORT_APPEND && existsSync(reportFile)) {
    rmSync(reportFile);
  }
  if (!existsSync(reportFile)) {
    writeFileSync(reportFile, '');
  }
  console.log(`[CSP] writing reports to ${reportFile}`);
}

const persistReports = (reports) => {
  if (!reportFile) return;
  if (!reports.length) return;
  const line = reports
    .map((report) =>
      JSON.stringify({
        timestamp: new Date().toISOString(),
        report,
      })
    )
    .join('\n');
  appendFileSync(reportFile, `${line}\n`, 'utf8');
};

const server = http.createServer((req, res) => {
  const { method, url } = req;
  if (method === 'POST' && url && url.startsWith(PREFIX)) {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const reports = Array.isArray(payload)
          ? payload
          : payload['csp-report']
          ? [payload['csp-report']]
          : payload.body && Array.isArray(payload.body)
          ? payload.body
          : [payload];
        const preview = JSON.stringify(reports).slice(0, 2000);
        console.error(`[CSP VIOLATION] ${preview}`);
        persistReports(reports);
  } catch {
        console.error(`[CSP VIOLATION:parse-error] ${body.slice(0, 1000)}`);
      }
      res.writeHead(204).end();
    });
    return;
  }

  if (method === 'GET' && url === `${PREFIX}/health`) {
    res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
    return;
  }

  res.writeHead(404).end('not found');
});

server.listen(PORT, () => {
  const where = `http://localhost:${PORT}${PREFIX}`;
  console.log(`[CSP] collector listening on ${where}`);
});
