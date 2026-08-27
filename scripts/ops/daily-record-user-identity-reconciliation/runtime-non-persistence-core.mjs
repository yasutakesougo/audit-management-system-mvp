const FORBIDDEN_FIELD = /(observation|memo|full_?name|fullname|display_?name|email|e-?mail|phone|address|comment|notes?)/i;
const FORBIDDEN_ENDPOINT = /(\$batch|contextinfo|validateupdatelistitem|renderlistdataasstream|recycle|recyclebin)/i;
const DIAGNOSTIC_ARG = /(^|=)(--inspect(?:-brk)?|--prof|--cpu-prof|--heap-prof|--heapsnapshot-signal|--report(?:-on-fatalerror|-uncaught-exception|-on-signal)?|--experimental-report|--trace-event-categories|--trace-event-file-pattern|--diagnostic-dir|--report-dir|--cpu-prof-dir|--heap-prof-dir)(=|$)/i;

const SAFE_ERROR_CODES = new Set([
  'LIVE_READ_DISABLED',
  'MISSING_RUNTIME_CONFIG',
  'INVALID_RUNTIME_CONFIG',
  'SOURCE_IDENTITY_MISMATCH',
  'NON_GET_BLOCKED',
  'UNSAFE_ENDPOINT_BLOCKED',
  'UNSAFE_FIELD_BLOCKED',
  'FIELD_ALLOWLIST_BLOCKED',
  'CONTINUATION_SCOPE_BLOCKED',
  'REDIRECT_BLOCKED',
  'DIAGNOSTIC_MODE_BLOCKED',
  'SHAREPOINT_READ_FAILED',
  'SHAREPOINT_INVALID_JSON',
  'PAGINATION_LIMIT_EXCEEDED',
  'SNAPSHOT_UNSTABLE',
  'RUNTIME_FAILURE',
]);

const COUNT_KEYS = [
  'dailyStable',
  'masterStable',
  'masterNonEmptyUnique',
  'masterEmpty',
  'masterDuplicateItems',
  'masterNormalizationCollisionItems',
  'resolved',
  'orphan',
  'ambiguous',
  'unknownFormat',
];

export class RuntimeGuardError extends Error {
  constructor(code, status = null) {
    const safeCode = SAFE_ERROR_CODES.has(code) ? code : 'RUNTIME_FAILURE';
    super(safeCode);
    this.name = 'RuntimeGuardError';
    this.code = safeCode;
    this.status = Number.isInteger(status) ? status : null;
  }
}

export function assertGetOnlyMethod(method) {
  if (String(method || '').toUpperCase() !== 'GET') {
    throw new RuntimeGuardError('NON_GET_BLOCKED');
  }
}

function normalizeFieldList(fields) {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new RuntimeGuardError('INVALID_RUNTIME_CONFIG');
  }
  const output = [];
  const seen = new Set();
  for (const raw of fields) {
    const field = String(raw || '').trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(field)) {
      throw new RuntimeGuardError('INVALID_RUNTIME_CONFIG');
    }
    if (FORBIDDEN_FIELD.test(field)) {
      throw new RuntimeGuardError('UNSAFE_FIELD_BLOCKED');
    }
    if (!seen.has(field)) {
      seen.add(field);
      output.push(field);
    }
  }
  return output;
}

export function assertSafeFieldProjection(fields) {
  return normalizeFieldList(fields);
}

export function assertExactFieldAllowlist(fields, allowlist) {
  const requested = normalizeFieldList(fields);
  const allowed = normalizeFieldList(allowlist);
  if (requested.length !== allowed.length) {
    throw new RuntimeGuardError('FIELD_ALLOWLIST_BLOCKED');
  }
  const allowedSet = new Set(allowed);
  for (const field of requested) {
    if (!allowedSet.has(field)) throw new RuntimeGuardError('FIELD_ALLOWLIST_BLOCKED');
  }
  return requested;
}

export function assertDiagnosticSafe({ execArgv = [], nodeOptions = '', env = {} } = {}) {
  const args = [
    ...(Array.isArray(execArgv) ? execArgv : []),
    ...String(nodeOptions || '').split(/\s+/).filter(Boolean),
  ];
  if (args.some((arg) => DIAGNOSTIC_ARG.test(String(arg)))) {
    throw new RuntimeGuardError('DIAGNOSTIC_MODE_BLOCKED');
  }
  for (const key of [
    'NODE_V8_COVERAGE',
    'NODE_REDIRECT_WARNINGS',
    'NODE_DEBUG_NATIVE',
  ]) {
    if (String(env?.[key] || '').trim()) {
      throw new RuntimeGuardError('DIAGNOSTIC_MODE_BLOCKED');
    }
  }
}

function normalizeSiteUrl(siteUrl) {
  const parsed = new URL(siteUrl);
  if (parsed.protocol !== 'https:') throw new RuntimeGuardError('INVALID_RUNTIME_CONFIG');
  parsed.hash = '';
  parsed.search = '';
  return parsed.toString().replace(/\/$/, '');
}

function resolveEndpoint(siteUrl, endpoint) {
  const site = new URL(normalizeSiteUrl(siteUrl));
  const raw = String(endpoint || '');
  const url = /^https?:\/\//i.test(raw)
    ? new URL(raw)
    : new URL(`${site.toString().replace(/\/$/, '')}${raw.startsWith('/') ? raw : `/${raw}`}`);
  const prefix = `${site.pathname.replace(/\/$/, '')}/_api/web/lists`.toLowerCase();
  const path = url.pathname.toLowerCase();

  if (
    url.origin !== site.origin ||
    !(path === prefix || path.startsWith(`${prefix}/`)) ||
    FORBIDDEN_ENDPOINT.test(`${url.pathname}${url.search}`)
  ) {
    throw new RuntimeGuardError('UNSAFE_ENDPOINT_BLOCKED');
  }
  return url;
}

function listItemsPath(url) {
  const marker = '/items';
  const lower = url.pathname.toLowerCase();
  const index = lower.indexOf(marker);
  if (index < 0) return null;
  return lower.slice(0, index + marker.length);
}

export function createGetOnlyTransport({ fetchImpl = globalThis.fetch, siteUrl, accessToken = '' }) {
  if (typeof fetchImpl !== 'function') throw new RuntimeGuardError('INVALID_RUNTIME_CONFIG');
  const normalizedSite = normalizeSiteUrl(siteUrl);

  return {
    validateContinuation(initialEndpoint, nextEndpoint) {
      const initial = resolveEndpoint(normalizedSite, initialEndpoint);
      const next = resolveEndpoint(normalizedSite, nextEndpoint);
      const initialItemsPath = listItemsPath(initial);
      const nextItemsPath = listItemsPath(next);
      if (!initialItemsPath || !nextItemsPath || initialItemsPath !== nextItemsPath) {
        throw new RuntimeGuardError('CONTINUATION_SCOPE_BLOCKED');
      }
      return next.toString();
    },

    async getJson(endpoint) {
      assertGetOnlyMethod('GET');
      const url = resolveEndpoint(normalizedSite, endpoint);
      const headers = { Accept: 'application/json;odata=nometadata' };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

      let response;
      try {
        response = await fetchImpl(url.toString(), { method: 'GET', headers, redirect: 'manual' });
      } catch {
        throw new RuntimeGuardError('SHAREPOINT_READ_FAILED');
      }
      if (response?.status >= 300 && response?.status < 400) {
        throw new RuntimeGuardError('REDIRECT_BLOCKED', response.status);
      }
      if (!response?.ok) {
        throw new RuntimeGuardError(
          'SHAREPOINT_READ_FAILED',
          Number.isInteger(response?.status) ? response.status : null,
        );
      }
      try {
        return await response.json();
      } catch {
        throw new RuntimeGuardError(
          'SHAREPOINT_INVALID_JSON',
          Number.isInteger(response?.status) ? response.status : null,
        );
      }
    },
  };
}

function quoteOData(value) {
  return String(value).replace(/'/g, "''");
}

function query(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${encodeURIComponent(String(value))}`)
    .join('&');
}

function listMetadataEndpoint(title) {
  return `/_api/web/lists/getbytitle('${quoteOData(title)}')?$select=Id,ItemCount`;
}

function highWaterEndpoint(title) {
  return `/_api/web/lists/getbytitle('${quoteOData(title)}')/items?${query({
    '$select': 'Id',
    '$orderby': 'Id desc',
    '$top': 1,
  })}`;
}

function boundedItemsEndpoint(title, fields, highWaterId) {
  const safeFields = normalizeFieldList(fields);
  if (!Number.isInteger(highWaterId) || highWaterId < 0) {
    throw new RuntimeGuardError('INVALID_RUNTIME_CONFIG');
  }
  return `/_api/web/lists/getbytitle('${quoteOData(title)}')/items?${query({
    '$select': safeFields.join(','),
    '$filter': `Id le ${highWaterId}`,
    '$orderby': 'Id asc',
    '$top': 5000,
  })}`;
}

function values(payload) {
  return Array.isArray(payload?.value) ? payload.value : [];
}

async function listMetadata(transport, title) {
  const payload = await transport.getJson(listMetadataEndpoint(title));
  return {
    id: typeof payload?.Id === 'string' ? payload.Id : '',
    itemCount: Number.isInteger(payload?.ItemCount) ? payload.ItemCount : null,
  };
}

async function highWaterId(transport, title) {
  const payload = await transport.getJson(highWaterEndpoint(title));
  const rows = values(payload);
  const id = rows.length ? Number(rows[0]?.Id) : 0;
  return Number.isInteger(id) && id >= 0 ? id : 0;
}

export async function enumerateAllItems({ transport, initialEndpoint, maxPages = 1000 }) {
  const rows = [];
  let endpoint = initialEndpoint;
  let pages = 0;
  while (endpoint) {
    pages += 1;
    if (pages > maxPages) {
      rows.length = 0;
      throw new RuntimeGuardError('PAGINATION_LIMIT_EXCEEDED');
    }
    const payload = await transport.getJson(endpoint);
    rows.push(...values(payload));
    const next = payload?.['@odata.nextLink'] || payload?.['odata.nextLink'] || null;
    if (next) {
      if (typeof transport.validateContinuation !== 'function') {
        rows.length = 0;
        throw new RuntimeGuardError('CONTINUATION_SCOPE_BLOCKED');
      }
      endpoint = transport.validateContinuation(initialEndpoint, next);
    } else {
      endpoint = null;
    }
  }
  return rows;
}

export function normalizeGuid(value) {
  return String(value || '').trim().replace(/^[{]/, '').replace(/[}]$/, '').toLowerCase();
}

function fingerprint(row, fields) {
  const projected = {};
  for (const field of fields) projected[field] = row?.[field] ?? null;
  projected.__etag = row?.['@odata.etag'] ?? row?.['odata.etag'] ?? null;
  return JSON.stringify(projected);
}

export function snapshotsMatch(rowsA, rowsB, fields) {
  if (!Array.isArray(rowsA) || !Array.isArray(rowsB) || rowsA.length !== rowsB.length) return false;
  const safeFields = normalizeFieldList(fields);
  const a = new Map();
  const b = new Map();

  for (const row of rowsA) {
    const id = Number(row?.Id);
    if (!Number.isInteger(id) || a.has(id)) return false;
    a.set(id, fingerprint(row, safeFields));
  }
  for (const row of rowsB) {
    const id = Number(row?.Id);
    if (!Number.isInteger(id) || b.has(id)) return false;
    b.set(id, fingerprint(row, safeFields));
  }
  if (a.size !== b.size) return false;
  for (const [id, value] of a) if (b.get(id) !== value) return false;
  return true;
}

export function assessMasterCanonicalIntegrity(rows, userIdField) {
  normalizeFieldList(['Id', userIdField]);
  const counts = new Map();
  let empty = 0;

  for (const row of rows) {
    const value = typeof row?.[userIdField] === 'string' ? row[userIdField].trim() : '';
    if (!value) {
      empty += 1;
      continue;
    }
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  let duplicateItems = 0;
  let nonEmptyUnique = 0;
  for (const count of counts.values()) {
    if (count > 1) duplicateItems += count;
    else nonEmptyUnique += 1;
  }

  return {
    nonEmptyUnique,
    empty,
    duplicateItems,
    normalizationCollisionItems: 0,
    status: empty === 0 && duplicateItems === 0 ? 'PASS' : 'HOLD',
  };
}

export function createSafeAggregate(overrides = {}) {
  const zeroCounts = Object.fromEntries(COUNT_KEYS.map((key) => [key, 0]));
  return {
    schemaVersion: 1,
    id: 'DAILY-RECORD-USER-IDENTITY-RECONCILIATION-V1',
    mode: 'EPHEMERAL_MEMORY_ONLY',
    runtimeStatus: 'BLOCKED',
    runtimeErrorCode: null,
    runCoverage: 'NOT_RUN',
    dailySnapshotStable: null,
    masterSnapshotStable: null,
    masterCanonicalIntegrity: 'NOT_ASSESSED',
    reconciliation: 'NOT_RUN',
    migrationReadiness: 'HOLD',
    counts: zeroCounts,
    ...overrides,
    counts: { ...zeroCounts, ...(overrides.counts || {}) },
  };
}

export function validateSafeAggregate(value) {
  const allowedTop = new Set([
    'schemaVersion', 'id', 'mode', 'runtimeStatus', 'runtimeErrorCode', 'runCoverage',
    'dailySnapshotStable', 'masterSnapshotStable', 'masterCanonicalIntegrity',
    'reconciliation', 'migrationReadiness', 'counts',
  ]);
  const enums = {
    runtimeStatus: new Set(['READY', 'BLOCKED', 'FAILED']),
    runCoverage: new Set(['NOT_RUN', 'INCOMPLETE', 'COMPLETE', 'BLOCKED']),
    masterCanonicalIntegrity: new Set(['PASS', 'HOLD', 'NOT_ASSESSED']),
    reconciliation: new Set(['NOT_RUN', 'HOLD', 'PASS', 'BLOCKED']),
    migrationReadiness: new Set(['GO', 'HOLD']),
  };

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RuntimeGuardError('INVALID_RUNTIME_CONFIG');
  }
  for (const key of Object.keys(value)) {
    if (!allowedTop.has(key)) throw new RuntimeGuardError('INVALID_RUNTIME_CONFIG');
  }
  if (
    value.schemaVersion !== 1 ||
    value.id !== 'DAILY-RECORD-USER-IDENTITY-RECONCILIATION-V1' ||
    value.mode !== 'EPHEMERAL_MEMORY_ONLY'
  ) throw new RuntimeGuardError('INVALID_RUNTIME_CONFIG');

  for (const [key, allowed] of Object.entries(enums)) {
    if (!allowed.has(value[key])) throw new RuntimeGuardError('INVALID_RUNTIME_CONFIG');
  }
  if (value.runtimeErrorCode !== null && !SAFE_ERROR_CODES.has(value.runtimeErrorCode)) {
    throw new RuntimeGuardError('INVALID_RUNTIME_CONFIG');
  }
  for (const key of ['dailySnapshotStable', 'masterSnapshotStable']) {
    if (value[key] !== null && typeof value[key] !== 'boolean') {
      throw new RuntimeGuardError('INVALID_RUNTIME_CONFIG');
    }
  }
  if (Object.keys(value.counts || {}).length !== COUNT_KEYS.length) {
    throw new RuntimeGuardError('INVALID_RUNTIME_CONFIG');
  }
  for (const key of COUNT_KEYS) {
    if (!Number.isInteger(value.counts?.[key]) || value.counts[key] < 0) {
      throw new RuntimeGuardError('INVALID_RUNTIME_CONFIG');
    }
  }
  return value;
}

export function createSafeReporter({ writeLine }) {
  if (typeof writeLine !== 'function') throw new RuntimeGuardError('INVALID_RUNTIME_CONFIG');
  return {
    report(aggregate) {
      writeLine(`${JSON.stringify(validateSafeAggregate(aggregate))}\n`);
    },
  };
}

export function blockedAggregate(code = 'RUNTIME_FAILURE') {
  return createSafeAggregate({
    runtimeStatus: 'BLOCKED',
    runtimeErrorCode: SAFE_ERROR_CODES.has(code) ? code : 'RUNTIME_FAILURE',
    runCoverage: 'BLOCKED',
    reconciliation: 'BLOCKED',
    migrationReadiness: 'HOLD',
  });
}

function assertSourceIdentity(meta, expectedGuid) {
  if (normalizeGuid(meta.id) !== normalizeGuid(expectedGuid)) {
    throw new RuntimeGuardError('SOURCE_IDENTITY_MISMATCH');
  }
}

export async function runSnapshotPhase({ transport, config }) {
  const dailyFields = assertExactFieldAllowlist(config.dailyFields, config.dailyAllowedFields);
  const masterFields = assertExactFieldAllowlist(config.masterFields, config.masterAllowedFields);
  if (!dailyFields.includes('Id') || !masterFields.includes('Id')) {
    throw new RuntimeGuardError('INVALID_RUNTIME_CONFIG');
  }

  const dailyA = [];
  const masterA = [];
  const dailyB = [];
  const masterB = [];
  const dailyFinal = [];
  const masterFinal = [];

  try {
    const dailyMeta = await listMetadata(transport, config.dailyListTitle);
    const masterMeta = await listMetadata(transport, config.masterListTitle);
    assertSourceIdentity(dailyMeta, config.expectedDailyListGuid);
    assertSourceIdentity(masterMeta, config.expectedMasterListGuid);

    const dailyHighWater = await highWaterId(transport, config.dailyListTitle);
    const masterHighWater = await highWaterId(transport, config.masterListTitle);
    const dailyEndpoint = boundedItemsEndpoint(config.dailyListTitle, dailyFields, dailyHighWater);
    const masterEndpoint = boundedItemsEndpoint(config.masterListTitle, masterFields, masterHighWater);

    // Required deterministic order: Daily A -> Master A -> Daily B -> Master B.
    dailyA.push(...await enumerateAllItems({ transport, initialEndpoint: dailyEndpoint }));
    masterA.push(...await enumerateAllItems({ transport, initialEndpoint: masterEndpoint }));
    dailyB.push(...await enumerateAllItems({ transport, initialEndpoint: dailyEndpoint }));
    masterB.push(...await enumerateAllItems({ transport, initialEndpoint: masterEndpoint }));

    const dailyStable = snapshotsMatch(dailyA, dailyB, dailyFields);
    const masterStable = snapshotsMatch(masterA, masterB, masterFields);
    if (!dailyStable || !masterStable) {
      return createSafeAggregate({
        runtimeStatus: 'FAILED',
        runtimeErrorCode: 'SNAPSHOT_UNSTABLE',
        runCoverage: 'INCOMPLETE',
        dailySnapshotStable: dailyStable,
        masterSnapshotStable: masterStable,
        reconciliation: 'HOLD',
      });
    }

    const masterIntegrity = assessMasterCanonicalIntegrity(masterB, config.masterUserIdField);

    // Final stability check: re-read the bounded populations and source identities.
    const finalDailyMeta = await listMetadata(transport, config.dailyListTitle);
    const finalMasterMeta = await listMetadata(transport, config.masterListTitle);
    assertSourceIdentity(finalDailyMeta, config.expectedDailyListGuid);
    assertSourceIdentity(finalMasterMeta, config.expectedMasterListGuid);

    dailyFinal.push(...await enumerateAllItems({ transport, initialEndpoint: dailyEndpoint }));
    masterFinal.push(...await enumerateAllItems({ transport, initialEndpoint: masterEndpoint }));
    const dailyFinalStable = snapshotsMatch(dailyB, dailyFinal, dailyFields);
    const masterFinalStable = snapshotsMatch(masterB, masterFinal, masterFields);
    if (!dailyFinalStable || !masterFinalStable) {
      return createSafeAggregate({
        runtimeStatus: 'FAILED',
        runtimeErrorCode: 'SNAPSHOT_UNSTABLE',
        runCoverage: 'INCOMPLETE',
        dailySnapshotStable: dailyFinalStable,
        masterSnapshotStable: masterFinalStable,
        masterCanonicalIntegrity: masterIntegrity.status,
        reconciliation: 'HOLD',
      });
    }

    return createSafeAggregate({
      runtimeStatus: 'READY',
      runCoverage: 'INCOMPLETE',
      dailySnapshotStable: true,
      masterSnapshotStable: true,
      masterCanonicalIntegrity: masterIntegrity.status,
      reconciliation: 'HOLD',
      migrationReadiness: 'HOLD',
      counts: {
        dailyStable: dailyB.length,
        masterStable: masterB.length,
        masterNonEmptyUnique: masterIntegrity.nonEmptyUnique,
        masterEmpty: masterIntegrity.empty,
        masterDuplicateItems: masterIntegrity.duplicateItems,
        masterNormalizationCollisionItems: masterIntegrity.normalizationCollisionItems,
      },
    });
  } finally {
    dailyA.length = 0;
    masterA.length = 0;
    dailyB.length = 0;
    masterB.length = 0;
    dailyFinal.length = 0;
    masterFinal.length = 0;
  }
}
