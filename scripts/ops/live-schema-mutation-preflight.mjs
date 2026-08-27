#!/usr/bin/env node
/**
 * LIVE-SCHEMA-MUTATION-V1 read-only preflight.
 *
 * Modes:
 *   --mode file   Classify a captured preflight dump (--input)
 *   --mode rest   SharePoint REST GET (storageState or SP_ACCESS_TOKEN)
 *   --mode hold   Write unread HOLD evidence (no network)
 *
 * Never Add/Set/Remove fields. Never writes list items.
 * Mutation Authority: NOT YET AUTHORIZED
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeInventoryField } from './live-schema-gate/classify.mjs';
import {
  LIVE_SCHEMA_MUTATION_ID,
  classifyMutationPreflight,
} from './live-schema-mutation/preflight-classify.mjs';

const FORBIDDEN_METHODS = new Set(['POST', 'PUT', 'PATCH', 'MERGE', 'DELETE']);
const FIELD_SELECT = 'InternalName,Title,TypeAsString,Indexed,EnforceUniqueValues,Hidden,ReadOnlyField';
const DEFAULT_SITE = 'https://isogokatudouhome.sharepoint.com/sites/welfare';
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_OUT = resolve(
  REPO_ROOT,
  'docs/evidence/live-schema-mutation-v1/captures/PREFLIGHT.json',
);

function parseArgs(argv) {
  const args = {
    mode: 'hold',
    input: null,
    out: DEFAULT_OUT,
    site: process.env.SHAREPOINT_SITE || process.env.VITE_SP_SITE_URL || DEFAULT_SITE,
    storageState: process.env.STORAGE_STATE_PATH || 'tests/.auth/storageState.json',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--mode' && value) { args.mode = value; i += 1; }
    else if (key === '--input' && value) { args.input = value; i += 1; }
    else if (key === '--out' && value) { args.out = resolve(value); i += 1; }
    else if (key === '--site' && value) { args.site = value.replace(/\/$/, ''); i += 1; }
    else if (key === '--storage-state' && value) { args.storageState = value; i += 1; }
  }
  return args;
}

function assertGetOnly(method) {
  const normalized = String(method || 'GET').toUpperCase();
  if (FORBIDDEN_METHODS.has(normalized) || normalized !== 'GET') {
    throw new Error(`[${LIVE_SCHEMA_MUTATION_ID}] Refusing non-GET HTTP method: ${method}`);
  }
}

function cookieHeaderFromStorageState(storageStatePath) {
  const abs = resolve(REPO_ROOT, storageStatePath);
  const parsed = JSON.parse(readFileSync(abs, 'utf8'));
  const cookies = Array.isArray(parsed.cookies) ? parsed.cookies : [];
  if (cookies.length === 0) {
    throw new Error(`No cookies in storageState: ${abs}`);
  }
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

async function getJson(url, headers) {
  assertGetOnly('GET');
  const res = await fetch(url, { method: 'GET', headers });
  return { res, json: res.ok ? await res.json() : null, text: res.ok ? null : await res.text() };
}

function summarizeTitles(items) {
  const counts = new Map();
  let nullOrBlank = 0;
  for (const item of items) {
    const raw = item.Title;
    if (raw == null || String(raw).trim() === '') {
      nullOrBlank += 1;
      continue;
    }
    const key = String(raw);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const duplicateGroups = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([title, count]) => ({ title, count }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
  return {
    itemRowsRead: items.length,
    distinctTitleCount: counts.size,
    nullOrBlankTitleCount: nullOrBlank,
    duplicateGroupCount: duplicateGroups.length,
    duplicateGroupsSample: duplicateGroups.slice(0, 50),
  };
}

async function fetchAllItems(site, listTitle, headers) {
  const items = [];
  let url =
    `${site}/_api/web/lists/GetByTitle('${listTitle.replace(/'/g, "''")}')/items` +
    `?$select=Id,Title&$top=5000`;
  while (url) {
    const { res, json, text } = await getJson(url, {
      ...headers,
      Accept: 'application/json;odata=nometadata',
    });
    if (!res.ok) {
      return { ok: false, items, error: `HTTP ${res.status}: ${String(text).slice(0, 300)}` };
    }
    items.push(...(json.value || json.d?.results || []));
    url = json['odata.nextLink'] || json['@odata.nextLink'] || null;
  }
  return { ok: true, items, error: null };
}

async function fetchRestPreflight(site, headers) {
  const lists = {};
  for (const title of ['SupportRecord_Daily', 'DailyRecordRows']) {
    const metaUrl =
      `${site}/_api/web/lists/GetByTitle('${title.replace(/'/g, "''")}')` +
      `?$select=Title,ItemCount,Id`;
    const { res: metaRes, json: metaJson, text: metaText } = await getJson(metaUrl, {
      ...headers,
      Accept: 'application/json;odata=nometadata',
    });
    if (metaRes.status === 404) {
      lists[title] = { found: false, itemCount: null, fields: [], titleStats: null, error: 'HTTP 404' };
      continue;
    }
    if (!metaRes.ok) {
      lists[title] = {
        found: null,
        itemCount: null,
        fields: null,
        titleStats: null,
        error: `HTTP ${metaRes.status}: ${String(metaText).slice(0, 300)}`,
      };
      continue;
    }

    const fieldsUrl =
      `${site}/_api/web/lists/GetByTitle('${title.replace(/'/g, "''")}')/fields` +
      `?$select=${FIELD_SELECT}&$top=5000`;
    const { res: fieldsRes, json: fieldsJson, text: fieldsText } = await getJson(fieldsUrl, {
      ...headers,
      Accept: 'application/json;odata=nometadata',
    });
    if (!fieldsRes.ok) {
      lists[title] = {
        found: true,
        itemCount: metaJson.ItemCount ?? null,
        listId: metaJson.Id ?? null,
        fields: null,
        titleStats: null,
        error: `fields HTTP ${fieldsRes.status}: ${String(fieldsText).slice(0, 300)}`,
      };
      continue;
    }

    const fields = (fieldsJson.value || fieldsJson.d?.results || []).map(normalizeInventoryField);
    let titleStats = null;
    let error = null;
    if (title === 'SupportRecord_Daily') {
      const itemsRes = await fetchAllItems(site, title, headers);
      if (!itemsRes.ok) error = itemsRes.error;
      else titleStats = summarizeTitles(itemsRes.items);
    }

    lists[title] = {
      found: true,
      itemCount: metaJson.ItemCount ?? null,
      listId: metaJson.Id ?? null,
      fields,
      titleStats,
      error,
    };
  }
  return lists;
}

function emptyLists(reason) {
  return {
    SupportRecord_Daily: { found: null, itemCount: null, fields: null, titleStats: null, error: reason },
    DailyRecordRows: { found: null, itemCount: null, fields: null, titleStats: null, error: reason },
  };
}

function writeReport(outPath, report) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let lists;
  let mode = args.mode;
  let httpMethods = [];
  let siteUrl = args.site;
  let generatedAt = new Date().toISOString();

  if (args.mode === 'hold') {
    lists = emptyLists('Preflight not executed in this run.');
    httpMethods = [];
  } else if (args.mode === 'file') {
    if (!args.input) throw new Error('--mode file requires --input <json>');
    const dump = JSON.parse(readFileSync(resolve(args.input), 'utf8'));
    lists = dump.lists;
    mode = dump.mode || 'file';
    siteUrl = dump.siteUrl || args.site;
    httpMethods = dump.httpMethods || ['GET'];
    generatedAt = dump.generatedAt || generatedAt;
    if (!lists) throw new Error('Input JSON must contain { lists: ... }');
  } else if (args.mode === 'rest') {
    httpMethods = ['GET'];
    const headers = {};
    if (process.env.SP_ACCESS_TOKEN) {
      headers.Authorization = `Bearer ${process.env.SP_ACCESS_TOKEN}`;
    } else {
      headers.Cookie = cookieHeaderFromStorageState(args.storageState);
    }
    lists = await fetchRestPreflight(args.site, headers);
  } else {
    throw new Error(`Unknown --mode ${args.mode}. Use hold | file | rest.`);
  }

  const classified = classifyMutationPreflight({ lists });
  const report = {
    schemaVersion: 1,
    generatedAt,
    mode,
    siteUrl,
    httpMethods,
    ...classified,
    rollbackEvidence: {
      schemaSnapshotIncluded: true,
      lists: Object.fromEntries(
        Object.entries(lists).map(([title, state]) => [
          title,
          {
            found: state?.found ?? null,
            itemCount: state?.itemCount ?? null,
            fieldCount: Array.isArray(state?.fields) ? state.fields.length : null,
            fields: Array.isArray(state?.fields) ? state.fields.map(normalizeInventoryField) : null,
            titleStats: state?.titleStats ?? null,
            error: state?.error ?? null,
          },
        ]),
      ),
    },
  };

  writeReport(args.out, report);
  console.log(JSON.stringify({
    id: report.id,
    phase: report.phase,
    preflightGate: report.preflightGate,
    mutationAuthority: report.mutationAuthority,
    deploy: report.deploy,
    holds: report.holds,
    titleStats: report.titleStats,
    fieldPlans: report.fieldPlans.map((plan) => ({
      id: plan.id,
      liveStatus: plan.liveStatus,
      applyEligible: plan.applyEligible,
    })),
    out: args.out,
  }, null, 2));

  if (report.preflightGate === 'HOLD') process.exitCode = 2;
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
