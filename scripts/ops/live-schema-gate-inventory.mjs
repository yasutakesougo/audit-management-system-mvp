#!/usr/bin/env node
/**
 * LIVE-SCHEMA-GATE-V1 read-only inventory.
 *
 * GET only. Never POST / PATCH / MERGE / DELETE. Never Add-PnPField / Set-PnPField.
 *
 * Modes:
 *   --mode hold     Write UNVERIFIED evidence (no network). Default when auth is absent.
 *   --mode file     Classify a previously captured JSON dump (--input).
 *   --mode rest     SharePoint REST fields GET (storageState or SP_ACCESS_TOKEN).
 *   --mode graph    Microsoft Graph list columns GET (GRAPH_ACCESS_TOKEN).
 *                   Graph v1.0 does not expose EnforceUniqueValues → Title unique stays UNVERIFIED.
 *
 * Usage:
 *   node scripts/ops/live-schema-gate-inventory.mjs --mode hold
 *   node scripts/ops/live-schema-gate-inventory.mjs --mode file --input dump.json
 *   node scripts/ops/live-schema-gate-inventory.mjs --mode rest
 *   node scripts/ops/live-schema-gate-inventory.mjs --mode graph
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  LIVE_SCHEMA_GATE_CHECKS,
  LIVE_SCHEMA_GATE_ID,
  classifyLiveSchemaInventory,
  normalizeInventoryField,
  summarizeLiveSchemaGate,
} from './live-schema-gate/classify.mjs';

const FORBIDDEN_METHODS = new Set(['POST', 'PUT', 'PATCH', 'MERGE', 'DELETE']);
const FIELD_SELECT = 'InternalName,Title,TypeAsString,Indexed,EnforceUniqueValues,Hidden,ReadOnlyField';
const DEFAULT_SITE = 'https://isogokatudouhome.sharepoint.com/sites/welfare';
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_OUT = resolve(
  REPO_ROOT,
  'docs/evidence/live-schema-gate-v1/captures/LIVE_SCHEMA_INVENTORY.json',
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
    throw new Error(`[${LIVE_SCHEMA_GATE_ID}] Refusing non-GET HTTP method: ${method}`);
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

function listTitles() {
  return [...new Set(LIVE_SCHEMA_GATE_CHECKS.map((check) => check.listTitle))];
}

async function fetchRestLists(site, headers) {
  const lists = {};
  for (const title of listTitles()) {
    const url =
      `${site}/_api/web/lists/GetByTitle('${title.replace(/'/g, "''")}')/fields` +
      `?$select=${FIELD_SELECT}&$top=5000`;
    const { res, json, text } = await getJson(url, {
      ...headers,
      Accept: 'application/json;odata=nometadata',
    });
    if (res.status === 404) {
      lists[title] = { found: false, uniqueConstraintReadable: true, fields: [], error: `HTTP 404 for ${title}` };
      continue;
    }
    if (!res.ok) {
      lists[title] = {
        found: null,
        uniqueConstraintReadable: true,
        fields: null,
        error: `HTTP ${res.status} for ${title}: ${String(text).slice(0, 300)}`,
      };
      continue;
    }
    const rawFields = json.value || json.d?.results || [];
    lists[title] = {
      found: true,
      uniqueConstraintReadable: true,
      fields: rawFields.map(normalizeInventoryField),
      error: null,
    };
  }
  return lists;
}

async function fetchGraphLists(site, token) {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/json',
  };
  const siteUrl = new URL(site);
  const sitePath = siteUrl.pathname.replace(/\/$/, '');
  const siteApi = `https://graph.microsoft.com/v1.0/sites/${siteUrl.host}:${sitePath}:`;
  const { res: siteRes, json: siteJson, text: siteText } = await getJson(
    `${siteApi}?$select=id,webUrl`,
    headers,
  );
  if (!siteRes.ok) {
    throw new Error(`Graph site lookup failed HTTP ${siteRes.status}: ${String(siteText).slice(0, 300)}`);
  }

  const lists = {};
  for (const title of listTitles()) {
    const filter = encodeURIComponent(`displayName eq '${title.replace(/'/g, "''")}'`);
    const { res: listRes, json: listJson, text: listText } = await getJson(
      `https://graph.microsoft.com/v1.0/sites/${siteJson.id}/lists?$filter=${filter}&$select=id,displayName,name`,
      headers,
    );
    if (!listRes.ok) {
      lists[title] = {
        found: null,
        uniqueConstraintReadable: false,
        fields: null,
        error: `Graph list lookup HTTP ${listRes.status}: ${String(listText).slice(0, 300)}`,
      };
      continue;
    }
    const match = (listJson.value || []).find((entry) => entry.displayName === title || entry.name === title);
    if (!match) {
      lists[title] = { found: false, uniqueConstraintReadable: false, fields: [], error: `Graph list not found: ${title}` };
      continue;
    }
    const { res: colRes, json: colJson, text: colText } = await getJson(
      `https://graph.microsoft.com/v1.0/sites/${siteJson.id}/lists/${match.id}/columns`,
      headers,
    );
    if (!colRes.ok) {
      lists[title] = {
        found: true,
        uniqueConstraintReadable: false,
        fields: null,
        error: `Graph columns HTTP ${colRes.status}: ${String(colText).slice(0, 300)}`,
      };
      continue;
    }
    lists[title] = {
      found: true,
      uniqueConstraintReadable: false,
      fields: (colJson.value || []).map(normalizeInventoryField),
      error: null,
    };
  }
  return lists;
}

function emptyUnverifiedLists(reason) {
  const lists = {};
  for (const title of listTitles()) {
    lists[title] = { found: null, uniqueConstraintReadable: false, fields: null, error: reason };
  }
  return lists;
}

function buildReport({ mode, site, lists, httpMethods, notes }) {
  const checks = classifyLiveSchemaInventory({ lists });
  const summary = summarizeLiveSchemaGate(checks);
  return {
    schemaVersion: 1,
    id: LIVE_SCHEMA_GATE_ID,
    generatedAt: new Date().toISOString(),
    mode,
    siteUrl: site,
    httpMethods,
    ...summary,
    mutation: false,
    schemaMutation: 'NONE',
    deploy: 'NOT_AUTHORIZED',
    checks,
    lists: Object.fromEntries(
      Object.entries(lists).map(([title, state]) => [
        title,
        {
          found: state.found,
          uniqueConstraintReadable: state.uniqueConstraintReadable,
          fieldCount: Array.isArray(state.fields) ? state.fields.length : null,
          error: state.error ?? null,
        },
      ]),
    ),
    notes,
  };
}

function writeReport(outPath, report) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let lists;
  let httpMethods = [];
  let notes = [];

  if (args.mode === 'hold') {
    lists = emptyUnverifiedLists(
      'List schema read was not performed in this run. Presence/absence must not be inferred.',
    );
    notes = ['HOLD mode: no SharePoint call. Gate stays UNVERIFIED.'];
  } else if (args.mode === 'file') {
    if (!args.input) {
      throw new Error('--mode file requires --input <json>');
    }
    const dump = JSON.parse(readFileSync(resolve(args.input), 'utf8'));
    lists = dump.lists;
    httpMethods = dump.httpMethods ?? ['GET'];
    notes = dump.notes ?? ['Classified from captured dump.'];
    if (!lists) {
      throw new Error('Input JSON must contain { lists: { ListTitle: { found, fields } } }');
    }
  } else if (args.mode === 'rest') {
    httpMethods = ['GET'];
    const headers = {};
    if (process.env.SP_ACCESS_TOKEN) {
      headers.Authorization = `Bearer ${process.env.SP_ACCESS_TOKEN}`;
    } else {
      headers.Cookie = cookieHeaderFromStorageState(args.storageState);
    }
    lists = await fetchRestLists(args.site, headers);
    notes = ['SharePoint REST fields GET. Indexed and EnforceUniqueValues are readable.'];
  } else if (args.mode === 'graph') {
    httpMethods = ['GET'];
    const token = process.env.GRAPH_ACCESS_TOKEN;
    if (!token) {
      throw new Error('GRAPH_ACCESS_TOKEN is required for --mode graph');
    }
    lists = await fetchGraphLists(args.site, token);
    notes = [
      'Microsoft Graph list columns GET.',
      'EnforceUniqueValues is not exposed on Graph v1.0 columnDefinition. Title unique stays UNVERIFIED unless a REST/PnP dump is used.',
    ];
  } else {
    throw new Error(`Unknown --mode ${args.mode}. Use hold | file | rest | graph.`);
  }

  const report = buildReport({
    mode: args.mode,
    site: args.site,
    lists,
    httpMethods,
    notes,
  });
  writeReport(args.out, report);
  console.log(JSON.stringify({
    id: report.id,
    gate: report.gate,
    liveSchema: report.liveSchema,
    mutation: report.mutation,
    deploy: report.deploy,
    out: args.out,
    checks: report.checks.map((check) => ({ id: check.id, status: check.status })),
  }, null, 2));

  if (report.gate === 'HOLD') process.exitCode = 2;
}

main().catch((error) => {
  console.error(`❌ ${error.message}`);
  process.exit(1);
});
