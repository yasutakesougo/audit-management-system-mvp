import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outputDir = process.env.LHCI_DIAGNOSTICS_DIR || 'reports/lhci-diagnostics';
const targetUrl = process.env.LHCI_TARGET_URL || 'http://127.0.0.1:4173/analysis/dashboard';
const probeIntervalMs = Number.parseInt(process.env.LHCI_PROBE_INTERVAL_MS || '1000', 10);

export function commandVersion(command, args = ['--version']) {
  try {
    return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    return `unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function probeUrl(url, fetchImpl = fetch) {
  const startedAt = Date.now();
  try {
    const response = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(3000) });
    return {
      timestamp: new Date().toISOString(),
      url,
      status: response.status,
      location: response.headers.get('location'),
      elapsedMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      timestamp: new Date().toISOString(),
      url,
      error: error instanceof Error ? error.message : String(error),
      elapsedMs: Date.now() - startedAt,
    };
  }
}

function processSnapshot() {
  try {
    return execFileSync('ps', ['-eo', 'pid,ppid,rss,etime,args'], { encoding: 'utf8' })
      .split('\n')
      .filter((line) => /chrome|chromium|lighthouse|vite/i.test(line))
      .join('\n');
  } catch (error) {
    return `unable to capture process list: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const perfLogPath = path.join(outputDir, 'perf-report.log');
  const probePath = path.join(outputDir, 'http-probes.jsonl');
  const processPath = path.join(outputDir, 'processes.log');
  const metadataPath = path.join(outputDir, 'runtime.json');
  const chromeCandidates = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
  const metadata = {
    generatedAt: new Date().toISOString(),
    targetUrl,
    targetPort: new URL(targetUrl).port || '80',
    platform: process.platform,
    architecture: process.arch,
    node: process.version,
    npm: commandVersion('npm'),
    lhci: commandVersion(path.resolve('node_modules/.bin/lhci')),
    chrome: Object.fromEntries(chromeCandidates.map((command) => [command, commandVersion(command)])),
    chromePath: process.env.CHROME_PATH || null,
  };
  fs.writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`);
  fs.writeFileSync(processPath, `# before\n${processSnapshot()}\n`);

  const logStream = fs.createWriteStream(perfLogPath, { flags: 'w' });
  const child = spawn('npm', ['run', '-s', 'ci:perf-report'], { env: process.env, stdio: ['inherit', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk) => { process.stdout.write(chunk); logStream.write(chunk); });
  child.stderr.on('data', (chunk) => { process.stderr.write(chunk); logStream.write(chunk); });

  let probing = false;
  const probe = async () => {
    if (probing) return;
    probing = true;
    fs.appendFileSync(probePath, `${JSON.stringify(await probeUrl(targetUrl))}\n`);
    probing = false;
  };
  await probe();
  const timer = setInterval(probe, Number.isFinite(probeIntervalMs) ? probeIntervalMs : 1000);
  const exitCode = await new Promise((resolve) => child.on('close', (code) => resolve(code ?? 1)));
  clearInterval(timer);
  await probe();
  logStream.end();
  fs.appendFileSync(processPath, `# after\n${processSnapshot()}\n`);
  process.exitCode = exitCode;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    console.error('[lhci-diagnostics] failed unexpectedly');
    console.error(error);
    process.exitCode = 1;
  });
}
