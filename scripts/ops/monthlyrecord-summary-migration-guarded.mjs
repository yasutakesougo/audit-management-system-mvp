/* eslint-disable no-console -- CLI ops script */
/**
 * MonthlyRecord_Summary Guarded Migration Procedure
 *
 * Purpose:
 * - Build a guarded migration plan from dry-run report and current list data
 * - Keep default mode as dry-run (no-write)
 * - Allow execution only with explicit safety confirmations
 *
 * Safety constraints:
 * - Scope limited to MonthlyRecord_Summary
 * - No column deletion / purge / provisioning changes
 * - Abort execution when dry-run report still has conflicts
 * - Migrate fallback-only rows only
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAccessToken, refreshM365Token } from './auth-helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');

const OUTPUT_DIR = join(REPO_ROOT, 'docs', 'audit', 'generated');
const DEFAULT_DRY_RUN_REPORT = join(OUTPUT_DIR, 'monthlyrecord-summary-migration-dry-run.json');
const OUTPUT_JSON = join(OUTPUT_DIR, 'monthlyrecord-summary-migration-guarded-plan.json');
const OUTPUT_MD = join(OUTPUT_DIR, 'monthlyrecord-summary-migration-guarded-plan.md');

const TARGET_LIST_TITLE = 'MonthlyRecord_Summary';

const MONTHLY_SUMMARY_MIGRATION_GROUPS = {
  idempotency: {
    canonical: ['IdempotencyKey', 'Idempotency_x0020_Key'],
    fallback: ['Key'],
  },
  totalDays: {
    canonical: ['KPI_TotalDays', 'TotalDays'],
    fallback: ['Total_x0020_Days'],
  },
  completedRows: {
    canonical: ['KPI_CompletedRows'],
    fallback: ['Completed_x0020_Rows', 'CompletedCount'],
  },
  inProgressRows: {
    canonical: ['KPI_InProgressRows'],
    fallback: ['In_x0020_Progress_x0020_Rows', 'PendingCount'],
  },
  emptyRows: {
    canonical: ['KPI_EmptyRows'],
    fallback: ['Empty_x0020_Rows', 'EmptyCount'],
  },
  incidents: {
    canonical: ['KPI_Incidents'],
    fallback: ['Incidents', 'IncidentCount'],
  },
  specialNotes: {
    canonical: ['KPI_SpecialNotes'],
    fallback: ['Special_x0020_Notes', 'SpecialNoteCount'],
  },
};

function hasFlag(args, flag) {
  return args.includes(flag);
}

function getArgValue(args, key, fallback = '') {
  const item = args.find((a) => a.startsWith(`${key}=`));
  return item ? item.slice(key.length + 1) : fallback;
}

function isPresent(v) {
  return v !== null && v !== undefined && String(v).trim() !== '';
}

function toComparable(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

async function spFetch(url, auth, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json;odata=nometadata',
      Authorization: `Bearer ${auth.token}`,
      ...(init.headers || {}),
    },
  });

  if (res.status === 401) {
    const newToken = refreshM365Token();
    if (newToken) {
      auth.token = newToken;
      return spFetch(url, auth, init);
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body}`);
  }

  return res;
}

async function spFetchJson(url, auth, init = {}) {
  const res = await spFetch(url, auth, init);
  return res.json();
}

async function getRequestDigest(siteApiRoot, auth) {
  const url = `${siteApiRoot}/contextinfo`;
  const data = await spFetchJson(url, auth, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;odata=nometadata',
    },
  });

  const digest = data?.FormDigestValue;
  if (!digest) {
    throw new Error('Failed to obtain FormDigestValue from /contextinfo');
  }

  return digest;
}

async function fetchAllItems(siteApiRoot, listTitle, selectFields, auth) {
  const encodedListTitle = listTitle.replace(/'/g, "''");
  const select = Array.from(selectFields).join(',');
  let nextUrl = `${siteApiRoot}/lists/getbytitle('${encodedListTitle}')/items?$select=${encodeURIComponent(select)}&$top=5000`;
  const rows = [];

  while (nextUrl) {
    const data = await spFetchJson(nextUrl, auth);
    rows.push(...(data.value || []));
    nextUrl = data['@odata.nextLink'] || '';
  }

  return rows;
}

async function fetchExistingFieldNames(siteApiRoot, listTitle, auth) {
  const encodedListTitle = listTitle.replace(/'/g, "''");
  let nextUrl = `${siteApiRoot}/lists/getbytitle('${encodedListTitle}')/fields?$select=InternalName&$top=5000`;
  const names = new Set();

  while (nextUrl) {
    const data = await spFetchJson(nextUrl, auth);
    for (const field of data.value || []) {
      const internalName = field?.InternalName;
      if (typeof internalName === 'string' && internalName.trim()) {
        names.add(internalName);
      }
    }
    nextUrl = data['@odata.nextLink'] || '';
  }

  return names;
}

function buildExistingSelectFields(groups, existingFields) {
  const requestedFields = new Set(['Id']);
  const missingFields = [];

  for (const def of Object.values(groups)) {
    for (const name of [...def.canonical, ...def.fallback]) {
      requestedFields.add(name);
    }
  }

  const selectedFields = new Set();
  for (const name of requestedFields) {
    if (existingFields.has(name)) {
      selectedFields.add(name);
    } else {
      missingFields.push(name);
    }
  }

  return {
    selectedFields,
    missingCandidateFields: Array.from(new Set(missingFields)).sort(),
  };
}

function evaluateGroup(row, groupDef) {
  let canonicalField = null;
  let canonicalValue = undefined;
  for (const name of groupDef.canonical) {
    if (isPresent(row[name])) {
      canonicalField = name;
      canonicalValue = row[name];
      break;
    }
  }

  let fallbackField = null;
  let fallbackValue = undefined;
  for (const name of groupDef.fallback) {
    if (isPresent(row[name])) {
      fallbackField = name;
      fallbackValue = row[name];
      break;
    }
  }

  const canonicalPresent = canonicalField !== null;
  const fallbackPresent = fallbackField !== null;

  if (canonicalPresent && fallbackPresent) {
    if (toComparable(canonicalValue) === toComparable(fallbackValue)) {
      return { outcome: 'bothSame', canonicalField, fallbackField, canonicalValue, fallbackValue };
    }
    return { outcome: 'bothDifferent', canonicalField, fallbackField, canonicalValue, fallbackValue };
  }

  if (canonicalPresent) {
    return { outcome: 'canonicalOnly', canonicalField, fallbackField, canonicalValue, fallbackValue };
  }

  if (fallbackPresent) {
    return { outcome: 'fallbackOnly', canonicalField, fallbackField, canonicalValue, fallbackValue };
  }

  return { outcome: 'empty', canonicalField, fallbackField, canonicalValue, fallbackValue };
}

function pickCanonicalTarget(groupDef, existingFields) {
  return groupDef.canonical.find((name) => existingFields.has(name)) || null;
}

function buildPlan(rows, existingFields) {
  const updates = [];
  const byGroup = {};
  const sampleConflictRowIds = [];

  for (const groupName of Object.keys(MONTHLY_SUMMARY_MIGRATION_GROUPS)) {
    byGroup[groupName] = {
      fallbackOnlyCount: 0,
      bothDifferentCount: 0,
      plannedUpdates: 0,
      missingCanonicalTargetCount: 0,
    };
  }

  for (const row of rows) {
    const rowId = row?.Id;
    if (!Number.isFinite(Number(rowId))) continue;

    for (const [groupName, def] of Object.entries(MONTHLY_SUMMARY_MIGRATION_GROUPS)) {
      const result = evaluateGroup(row, def);

      if (result.outcome === 'bothDifferent') {
        byGroup[groupName].bothDifferentCount += 1;
        if (sampleConflictRowIds.length < 25) {
          sampleConflictRowIds.push(Number(rowId));
        }
        continue;
      }

      if (result.outcome !== 'fallbackOnly') continue;

      byGroup[groupName].fallbackOnlyCount += 1;
      const canonicalTarget = pickCanonicalTarget(def, existingFields);
      if (!canonicalTarget) {
        byGroup[groupName].missingCanonicalTargetCount += 1;
        continue;
      }
      if (!isPresent(result.fallbackValue)) continue;

      byGroup[groupName].plannedUpdates += 1;
      updates.push({
        rowId: Number(rowId),
        group: groupName,
        canonicalField: canonicalTarget,
        fallbackField: result.fallbackField,
        value: result.fallbackValue,
      });
    }
  }

  const summary = {
    scannedRows: rows.length,
    plannedUpdateCount: updates.length,
    groupsWithPlannedUpdates: Object.values(byGroup).filter((g) => g.plannedUpdates > 0).length,
    conflictCount: Object.values(byGroup).reduce((acc, g) => acc + g.bothDifferentCount, 0),
    fallbackOnlyCount: Object.values(byGroup).reduce((acc, g) => acc + g.fallbackOnlyCount, 0),
    missingCanonicalTargetCount: Object.values(byGroup).reduce((acc, g) => acc + g.missingCanonicalTargetCount, 0),
    destructiveOperationIncluded: false,
  };

  return {
    summary,
    byGroup,
    updates,
    sampleConflictRowIds: Array.from(new Set(sampleConflictRowIds)).slice(0, 25),
  };
}

async function updateItem(siteApiRoot, listTitle, rowId, patch, auth, formDigest) {
  const encodedListTitle = listTitle.replace(/'/g, "''");
  const endpoint = `${siteApiRoot}/lists/getbytitle('${encodedListTitle}')/items(${rowId})`;
  await spFetch(endpoint, auth, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;odata=nometadata',
      'X-RequestDigest': formDigest,
      'IF-MATCH': '*',
      'X-HTTP-Method': 'MERGE',
    },
    body: JSON.stringify(patch),
  });
}

function summarizeForMarkdown(report) {
  const lines = [];
  lines.push('# MonthlyRecord_Summary Guarded Migration Procedure Report');
  lines.push('');
  lines.push(`- GeneratedAt: ${report.generatedAt}`);
  lines.push(`- ListTitle: ${report.listTitle}`);
  lines.push(`- Mode: ${report.mode}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('| --- | ---: |');
  for (const [k, v] of Object.entries(report.summary)) {
    lines.push(`| ${k} | ${v} |`);
  }

  lines.push('');
  lines.push('## Guard Status');
  lines.push('');
  lines.push(`- executeRequested: ${report.guard.executeRequested}`);
  lines.push(`- backupConfirmed: ${report.guard.backupConfirmed}`);
  lines.push(`- reportReviewedConfirmed: ${report.guard.reportReviewedConfirmed}`);
  lines.push(`- blockedByConflict: ${report.guard.blockedByConflict}`);
  lines.push(`- writeAllowed: ${report.guard.writeAllowed}`);

  lines.push('');
  lines.push('## By Group');
  lines.push('');
  lines.push('| Group | fallbackOnlyCount | bothDifferentCount | plannedUpdates | missingCanonicalTargetCount |');
  lines.push('| --- | ---: | ---: | ---: | ---: |');
  for (const [group, stats] of Object.entries(report.byGroup)) {
    lines.push(`| ${group} | ${stats.fallbackOnlyCount} | ${stats.bothDifferentCount} | ${stats.plannedUpdates} | ${stats.missingCanonicalTargetCount} |`);
  }

  if (report.sampleConflictRowIds.length > 0) {
    lines.push('');
    lines.push('## Sample Conflict Row IDs');
    lines.push('');
    lines.push(report.sampleConflictRowIds.join(', '));
  }

  lines.push('');
  lines.push('## Safety Note');
  lines.push('');
  lines.push('This procedure does not include column deletion, purge behavior, or provisioning changes.');

  return `${lines.join('\n')}\n`;
}

function buildPatchBatch(updates, batchSize) {
  const map = new Map();
  for (const item of updates) {
    const key = item.rowId;
    if (!map.has(key)) {
      map.set(key, { rowId: key, patch: {} });
    }
    map.get(key).patch[item.canonicalField] = item.value;
  }

  const merged = Array.from(map.values());
  if (!Number.isFinite(batchSize) || batchSize <= 0) return merged;
  return merged.slice(0, batchSize);
}

async function main() {
  const args = process.argv.slice(2);
  const executeRequested = hasFlag(args, '--execute');
  const backupConfirmed = hasFlag(args, '--confirm-backup');
  const reportReviewedConfirmed = hasFlag(args, '--confirm-reviewed-report');
  const reportPath = resolve(getArgValue(args, '--report', DEFAULT_DRY_RUN_REPORT));
  const batchSizeRaw = Number(getArgValue(args, '--batch', '0'));
  const batchSize = Number.isFinite(batchSizeRaw) && batchSizeRaw > 0 ? batchSizeRaw : 0;

  const siteUrl = process.env.VITE_SP_SITE_URL;
  const listTitle = process.env.VITE_SP_LIST_BILLING_SUMMARY || TARGET_LIST_TITLE;
  const auth = { token: getAccessToken() };

  if (listTitle !== TARGET_LIST_TITLE) {
    throw new Error(`Scope violation: this script only supports ${TARGET_LIST_TITLE}.`);
  }

  if (!siteUrl || !auth.token) {
    throw new Error('Missing credentials. Ensure VITE_SP_SITE_URL and token are available.');
  }

  const dryRunReport = JSON.parse(readFileSync(reportPath, 'utf8'));
  const dryRunConflictCount = Number(dryRunReport?.summary?.conflictCount || 0);

  const blockedByConflict = dryRunConflictCount > 0;
  const writeAllowed = executeRequested && backupConfirmed && reportReviewedConfirmed && !blockedByConflict;

  const siteApiRoot = siteUrl.endsWith('/_api/web')
    ? siteUrl
    : `${siteUrl.replace(/\/$/, '')}/_api/web`;

  const existingFields = await fetchExistingFieldNames(siteApiRoot, listTitle, auth);
  const { selectedFields, missingCandidateFields } = buildExistingSelectFields(
    MONTHLY_SUMMARY_MIGRATION_GROUPS,
    existingFields,
  );

  console.log(`🔎 Building guarded migration plan for list: ${listTitle}`);
  const rows = await fetchAllItems(siteApiRoot, listTitle, selectedFields, auth);
  const plan = buildPlan(rows, existingFields);

  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    listTitle,
    mode: writeAllowed ? 'execute' : 'dry-run',
    dryRunReportPath: reportPath,
    dryRunConflictCount,
    metadata: {
      selectedFields: Array.from(selectedFields).sort(),
      missingCandidateFields,
    },
    summary: plan.summary,
    byGroup: plan.byGroup,
    sampleConflictRowIds: plan.sampleConflictRowIds,
    guard: {
      executeRequested,
      backupConfirmed,
      reportReviewedConfirmed,
      blockedByConflict,
      writeAllowed,
    },
    safety: {
      destructiveOperationIncluded: false,
      includesColumnDeletion: false,
      includesProvisioningChange: false,
      includesPurge: false,
    },
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2), 'utf8');
  writeFileSync(OUTPUT_MD, summarizeForMarkdown(report), 'utf8');

  console.log(`✅ JSON: ${OUTPUT_JSON}`);
  console.log(`✅ Markdown: ${OUTPUT_MD}`);

  if (executeRequested && !writeAllowed) {
    const reasons = [];
    if (!backupConfirmed) reasons.push('--confirm-backup is missing');
    if (!reportReviewedConfirmed) reasons.push('--confirm-reviewed-report is missing');
    if (blockedByConflict) reasons.push(`dry-run conflictCount=${dryRunConflictCount} (> 0)`);

    console.log('⛔ Execution blocked by safety guard(s):');
    for (const reason of reasons) {
      console.log(`  - ${reason}`);
    }
    process.exit(2);
  }

  if (!writeAllowed) {
    console.log('ℹ️ Dry-run mode only. No SharePoint updates performed.');
    return;
  }

  const mergedPatches = buildPatchBatch(plan.updates, batchSize);
  console.log(`🚀 Executing guarded migration updates: ${mergedPatches.length} rows`);

  const formDigest = await getRequestDigest(siteApiRoot, auth);
  let applied = 0;
  for (const item of mergedPatches) {
    await updateItem(siteApiRoot, listTitle, item.rowId, item.patch, auth, formDigest);
    applied += 1;
  }

  console.log(`✅ Guarded migration complete. Updated rows: ${applied}`);
}

main().catch((error) => {
  console.error('❌ Guarded migration procedure failed:', error.message || error);
  process.exit(1);
});
