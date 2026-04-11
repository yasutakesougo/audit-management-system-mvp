import fs from 'node:fs';
import path from 'node:path';

function isDateStamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function utcTodayStamp() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function normalizeCandidate(root, candidate) {
  if (!candidate || typeof candidate !== 'string') return null;
  const trimmed = candidate.trim();
  if (!trimmed) return null;
  return path.isAbsolute(trimmed) ? trimmed : path.join(root, trimmed);
}

export function resolveSpTelemetryInput(options = {}) {
  const root = options.root || process.cwd();
  const reportDir = options.reportDir || path.join(root, 'docs', 'nightly-patrol');
  const date = isDateStamp(options.date) ? options.date : utcTodayStamp();
  const envPath = typeof options.envPath === 'string' ? options.envPath : process.env.SP_TELEMETRY_PATH || '';
  const preferRootDump = options.preferRootDump === true;

  const implicitCandidates = preferRootDump
    ? [
        path.join(root, `sp-telemetry-${date}.json`),
        path.join(root, 'sp-telemetry.json'),
        path.join(reportDir, `sp-telemetry-${date}.json`),
        path.join(reportDir, 'sp-telemetry.json'),
      ]
    : [
        path.join(reportDir, `sp-telemetry-${date}.json`),
        path.join(reportDir, 'sp-telemetry.json'),
        path.join(root, `sp-telemetry-${date}.json`),
        path.join(root, 'sp-telemetry.json'),
      ];

  const candidates = [
    envPath,
    ...implicitCandidates,
  ]
    .map((candidate) => normalizeCandidate(root, candidate))
    .filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return {
        resolvedPath: candidate,
        usedEnvPath: Boolean(envPath && path.resolve(candidate) === path.resolve(normalizeCandidate(root, envPath))),
      };
    }
  }

  return {
    resolvedPath: null,
    usedEnvPath: false,
    candidates: candidates.map((candidate) => path.relative(root, candidate).replace(/\\/g, '/')),
  };
}
