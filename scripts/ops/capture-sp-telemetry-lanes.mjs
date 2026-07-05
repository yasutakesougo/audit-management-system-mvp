/* eslint-disable no-console -- CI ops script */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const SOURCE_KIND = 'nightly-patrol-sp-token-read-probe';
export const DEFAULT_OUTPUT_PATH = path.join('docs', 'nightly-patrol', 'sp-telemetry.json');

const EMPTY_LANE = Object.freeze({
  requests: 0,
  failed: 0,
  retries: 0,
  maxQueuedMs: 0,
  avgQueuedMs: 0,
  avgDurationMs: 0,
});

function cloneLane(lane = {}) {
  return {
    requests: Number(lane.requests ?? 0),
    failed: Number(lane.failed ?? 0),
    retries: Number(lane.retries ?? 0),
    maxQueuedMs: Number(lane.maxQueuedMs ?? 0),
    avgQueuedMs: Number(lane.avgQueuedMs ?? 0),
    avgDurationMs: Number(lane.avgDurationMs ?? 0),
  };
}

function createMetrics({ readLane, durationMs = 0 }) {
  const read = cloneLane(readLane);
  const write = cloneLane(EMPTY_LANE);
  const provisioning = cloneLane(EMPTY_LANE);
  const failedCount = read.failed + write.failed + provisioning.failed;
  const retryCount = read.retries + write.retries + provisioning.retries;

  return {
    throttledCount: 0,
    retryCount,
    failedCount,
    avgDurationMs: read.requests > 0 ? Math.round(durationMs / read.requests) : 0,
    p95DurationMs: read.requests > 0 ? durationMs : 0,
    avgQueuedMs: 0,
    maxQueuedMs: read.maxQueuedMs,
    lanes: {
      read,
      write,
      provisioning,
    },
    assignmentConcurrencyConflicts: 0,
    assignmentConflictVehicles: [],
    assignmentConflictResolved: 0,
    assignmentConflictUnresolved: 0,
    assignmentRetryTotal: 0,
  };
}

function normalizeSiteRelative(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return '';
  return (trimmed.startsWith('/') ? trimmed : `/${trimmed}`).replace(/\/+$/, '');
}

export function resolveSharePointProbeConfig(env = process.env) {
  const resourceRaw = String(env.VITE_SP_RESOURCE ?? '').trim();
  const siteRelative = normalizeSiteRelative(env.VITE_SP_SITE_RELATIVE);

  if (!resourceRaw) {
    throw Object.assign(new Error('VITE_SP_RESOURCE is required.'), { code: 'sp_config_missing_resource' });
  }
  if (!siteRelative) {
    throw Object.assign(new Error('VITE_SP_SITE_RELATIVE is required.'), { code: 'sp_config_missing_site_relative' });
  }

  let resourceUrl;
  try {
    resourceUrl = new URL(resourceRaw);
  } catch {
    throw Object.assign(new Error('VITE_SP_RESOURCE must be a valid URL.'), { code: 'sp_config_invalid_resource' });
  }

  if (resourceUrl.protocol !== 'https:' || !/\.sharepoint\.com$/i.test(resourceUrl.hostname)) {
    throw Object.assign(new Error('VITE_SP_RESOURCE must be an https://*.sharepoint.com origin.'), {
      code: 'sp_config_invalid_resource',
    });
  }

  if (!siteRelative.startsWith('/sites/') && !siteRelative.startsWith('/teams/')) {
    throw Object.assign(new Error('VITE_SP_SITE_RELATIVE must start with /sites/ or /teams/.'), {
      code: 'sp_config_invalid_site_relative',
    });
  }

  const resource = resourceUrl.origin.replace(/\/+$/, '');
  const baseUrl = `${resource}${siteRelative}/_api/web`;

  return {
    resource,
    siteRelative,
    endpointPath: '/_api/web/currentuser',
    probeUrl: `${baseUrl}/currentuser?$select=Id,Title`,
  };
}

function createSnapshot({ generatedAt, readLane, durationMs, diagnostics, topEndpoints }) {
  const metrics = createMetrics({ readLane, durationMs });
  return {
    generatedAt,
    source: {
      kind: SOURCE_KIND,
    },
    metrics,
    summary: metrics,
    topEndpoints,
    diagnostics,
  };
}

function failureSnapshot({ generatedAt, code, message, requestStarted = false, endpointPath = '/_api/web/currentuser', status, durationMs = 0 }) {
  const readLane = {
    requests: requestStarted ? 1 : 0,
    failed: 1,
    retries: 0,
    maxQueuedMs: 0,
    avgQueuedMs: 0,
    avgDurationMs: requestStarted ? durationMs : 0,
  };

  return createSnapshot({
    generatedAt,
    readLane,
    durationMs: requestStarted ? durationMs : 0,
    topEndpoints: requestStarted
      ? [{ endpoint: endpointPath, failures: 1, retries: 0, status: status ?? null, durationMs }]
      : [],
    diagnostics: [{ code, message }],
  });
}

export async function captureSpTelemetryLanes(options = {}) {
  const env = options.env ?? process.env;
  const now = options.now ?? (() => new Date());
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const generatedAt = now().toISOString();
  const token = String(env.SP_TOKEN ?? '').trim();

  if (!token) {
    return failureSnapshot({
      generatedAt,
      code: 'sp_token_missing',
      message: 'SP_TOKEN is required for the Nightly Patrol SharePoint read probe.',
    });
  }

  let config;
  try {
    config = resolveSharePointProbeConfig(env);
  } catch (error) {
    return failureSnapshot({
      generatedAt,
      code: error?.code || 'sp_config_invalid',
      message: error instanceof Error ? error.message : 'SharePoint probe config is invalid.',
    });
  }

  if (typeof fetchImpl !== 'function') {
    return failureSnapshot({
      generatedAt,
      code: 'fetch_unavailable',
      message: 'global fetch is not available in this Node runtime.',
    });
  }

  const startedAt = Date.now();
  try {
    const response = await fetchImpl(config.probeUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json;odata=nometadata',
      },
    });
    const durationMs = Math.max(0, Date.now() - startedAt);

    if (!response.ok) {
      return failureSnapshot({
        generatedAt,
        code: 'sp_probe_http_non_ok',
        message: `SharePoint read probe returned HTTP ${response.status}.`,
        requestStarted: true,
        endpointPath: config.endpointPath,
        status: response.status,
        durationMs,
      });
    }

    const readLane = {
      requests: 1,
      failed: 0,
      retries: 0,
      maxQueuedMs: 0,
      avgQueuedMs: 0,
      avgDurationMs: durationMs,
    };

    return createSnapshot({
      generatedAt,
      readLane,
      durationMs,
      topEndpoints: [{ endpoint: config.endpointPath, failures: 0, retries: 0, status: response.status, durationMs }],
      diagnostics: [{ code: 'sp_probe_ok', message: 'SharePoint read probe completed.' }],
    });
  } catch (error) {
    return failureSnapshot({
      generatedAt,
      code: 'sp_probe_fetch_error',
      message: error instanceof Error ? error.message : 'SharePoint read probe failed.',
      requestStarted: true,
      endpointPath: config.endpointPath,
      durationMs: Math.max(0, Date.now() - startedAt),
    });
  }
}

export function writeSpTelemetrySnapshot(snapshot, outputPath = DEFAULT_OUTPUT_PATH, options = {}) {
  const root = options.root ?? process.cwd();
  const resolvedPath = path.isAbsolute(outputPath) ? outputPath : path.join(root, outputPath);
  fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
  fs.writeFileSync(resolvedPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
  return resolvedPath;
}

export async function captureAndWriteSpTelemetryLanes(options = {}) {
  const snapshot = await captureSpTelemetryLanes(options);
  const outputPath = writeSpTelemetrySnapshot(
    snapshot,
    options.outputPath ?? options.env?.SP_TELEMETRY_OUTPUT_PATH ?? process.env.SP_TELEMETRY_OUTPUT_PATH ?? DEFAULT_OUTPUT_PATH,
    { root: options.root },
  );
  return { snapshot, outputPath };
}

async function main() {
  const { snapshot, outputPath } = await captureAndWriteSpTelemetryLanes();
  const relativeOutput = path.relative(process.cwd(), outputPath) || outputPath;
  const codes = snapshot.diagnostics.map((entry) => entry.code).join(', ');
  console.log(`[sp-telemetry] wrote ${relativeOutput}`);
  console.log(`[sp-telemetry] diagnostics: ${codes}`);
  if (snapshot.metrics.failedCount > 0) {
    console.warn('[sp-telemetry] read probe captured a failure; lane assertion will evaluate it.');
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  main().catch((error) => {
    console.error('[sp-telemetry] failed to write telemetry artifact.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
