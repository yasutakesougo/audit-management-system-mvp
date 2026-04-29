/* eslint-disable no-console -- CLI ops script */
/**
 * MonthlyRecord_Summary Migration Dry-Run Report
 *
 * Read-only audit script:
 * - Reads MonthlyRecord_Summary rows via SharePoint REST
 * - Compares canonical vs fallback candidates by migration risk group
 * - Emits summary-only JSON/Markdown artifacts for review
 *
 * Non-destructive guarantee:
 * - No create/update/delete
 * - No provisioning changes
 * - No runtime behavior changes
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAccessToken, refreshM365Token } from './auth-helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..', '..');

const OUTPUT_DIR = join(REPO_ROOT, 'docs', 'audit', 'generated');
const OUTPUT_JSON = join(OUTPUT_DIR, 'monthlyrecord-summary-migration-dry-run.json');
const OUTPUT_MD = join(OUTPUT_DIR, 'monthlyrecord-summary-migration-dry-run.md');

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

function isPresent(v) {
  return v !== null && v !== undefined && String(v).trim() !== '';
}

function toComparable(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

async function spFetch(url, auth) {
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json;odata=nometadata',
      Authorization: `Bearer ${auth.token}`,
    },
  });

  if (res.status === 401) {
    const newToken = refreshM365Token();
    if (newToken) {
      auth.token = newToken;
      return spFetch(url, auth);
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body}`);
  }

  return res.json();
}

async function fetchAllItems(siteApiRoot, listTitle, selectFields, auth) {
  const encodedListTitle = listTitle.replace(/'/g, "''");
  const select = Array.from(selectFields).join(',');
  let nextUrl = `${siteApiRoot}/lists/getbytitle('${encodedListTitle}')/items?$select=${encodeURIComponent(select)}&$top=5000`;
  const rows = [];

  while (nextUrl) {
    const data = await spFetch(nextUrl, auth);
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
    const data = await spFetch(nextUrl, auth);
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
      return 'bothSame';
    }
    return 'bothDifferent';
  }

  if (canonicalPresent) return 'canonicalOnly';
  if (fallbackPresent) return 'fallbackOnly';
  return 'empty';
}

function createEmptyGroupStats() {
  return {
    scannedRows: 0,
    canonicalOnlyCount: 0,
    fallbackOnlyCount: 0,
    bothSameCount: 0,
    bothDifferentCount: 0,
    emptyCount: 0,
    conflictCount: 0,
    migrationCandidateCount: 0,
  };
}

function aggregate(rows) {
  const byGroup = {};
  for (const [groupName] of Object.entries(MONTHLY_SUMMARY_MIGRATION_GROUPS)) {
    byGroup[groupName] = createEmptyGroupStats();
  }

  for (const row of rows) {
    for (const [groupName, def] of Object.entries(MONTHLY_SUMMARY_MIGRATION_GROUPS)) {
      const outcome = evaluateGroup(row, def);
      const stats = byGroup[groupName];
      stats.scannedRows += 1;

      if (outcome === 'canonicalOnly') stats.canonicalOnlyCount += 1;
      if (outcome === 'fallbackOnly') stats.fallbackOnlyCount += 1;
      if (outcome === 'bothSame') stats.bothSameCount += 1;
      if (outcome === 'bothDifferent') stats.bothDifferentCount += 1;
      if (outcome === 'empty') stats.emptyCount += 1;

      if (outcome === 'bothDifferent') stats.conflictCount += 1;
      if (outcome === 'fallbackOnly' || outcome === 'bothDifferent') {
        stats.migrationCandidateCount += 1;
      }
    }
  }

  const summary = {
    scannedRows: rows.length,
    fieldGroups: Object.keys(MONTHLY_SUMMARY_MIGRATION_GROUPS).length,
    migrationCandidateCount: 0,
    conflictCount: 0,
    canonicalOnlyCount: 0,
    fallbackOnlyCount: 0,
    bothSameCount: 0,
    bothDifferentCount: 0,
    emptyCount: 0,
  };

  for (const stats of Object.values(byGroup)) {
    summary.migrationCandidateCount += stats.migrationCandidateCount;
    summary.conflictCount += stats.conflictCount;
    summary.canonicalOnlyCount += stats.canonicalOnlyCount;
    summary.fallbackOnlyCount += stats.fallbackOnlyCount;
    summary.bothSameCount += stats.bothSameCount;
    summary.bothDifferentCount += stats.bothDifferentCount;
    summary.emptyCount += stats.emptyCount;
  }

  return { summary, byGroup };
}

function toMarkdown(report) {
  const lines = [];
  lines.push('# MonthlyRecord_Summary Migration Dry-Run Report');
  lines.push('');
  lines.push(`- GeneratedAt: ${report.generatedAt}`);
  lines.push(`- ListTitle: ${report.listTitle}`);
  lines.push(`- Mode: dry-run (read-only)`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('| --- | ---: |');
  for (const [k, v] of Object.entries(report.summary)) {
    lines.push(`| ${k} | ${v} |`);
  }
  lines.push('');
  lines.push('## By Group');
  lines.push('');
  lines.push('| Group | scannedRows | migrationCandidateCount | conflictCount | canonicalOnlyCount | fallbackOnlyCount | bothSameCount | bothDifferentCount | emptyCount |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');

  for (const [group, stats] of Object.entries(report.byGroup)) {
    lines.push(`| ${group} | ${stats.scannedRows} | ${stats.migrationCandidateCount} | ${stats.conflictCount} | ${stats.canonicalOnlyCount} | ${stats.fallbackOnlyCount} | ${stats.bothSameCount} | ${stats.bothDifferentCount} | ${stats.emptyCount} |`);
  }

  lines.push('');
  lines.push('## Safety');
  lines.push('');
  lines.push(`- canProceedToMigration: ${report.safety.canProceedToMigration}`);
  lines.push(`- requiresReview: ${report.safety.requiresReview}`);
  lines.push(`- destructiveOperationIncluded: ${report.safety.destructiveOperationIncluded}`);
  lines.push('');
  lines.push('Note: This artifact is summary-only and does not include row-level personal data.');

  return `${lines.join('\n')}\n`;
}

async function main() {
  const siteUrl = process.env.VITE_SP_SITE_URL;
  const listTitle = process.env.VITE_SP_LIST_BILLING_SUMMARY || 'MonthlyRecord_Summary';
  const auth = { token: getAccessToken() };

  if (!siteUrl || !auth.token) {
    throw new Error('Missing credentials. Ensure VITE_SP_SITE_URL and token are available.');
  }

  const siteApiRoot = siteUrl.endsWith('/_api/web')
    ? siteUrl
    : `${siteUrl.replace(/\/$/, '')}/_api/web`;

  const existingFields = await fetchExistingFieldNames(siteApiRoot, listTitle, auth);
  const { selectedFields, missingCandidateFields } = buildExistingSelectFields(
    MONTHLY_SUMMARY_MIGRATION_GROUPS,
    existingFields,
  );

  console.log(`🔎 Running dry-run migration report for list: ${listTitle}`);
  const rows = await fetchAllItems(siteApiRoot, listTitle, selectedFields, auth);
  const { summary, byGroup } = aggregate(rows);

  const report = {
    version: 1,
    generatedAt: new Date().toISOString(),
    listTitle,
    mode: 'dry-run',
    metadata: {
      selectedFields: Array.from(selectedFields).sort(),
      missingCandidateFields,
    },
    summary,
    byGroup,
    safety: {
      canProceedToMigration: false,
      requiresReview: summary.conflictCount > 0,
      destructiveOperationIncluded: false,
    },
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_JSON, JSON.stringify(report, null, 2), 'utf8');
  writeFileSync(OUTPUT_MD, toMarkdown(report), 'utf8');

  console.log(`✅ JSON: ${OUTPUT_JSON}`);
  console.log(`✅ Markdown: ${OUTPUT_MD}`);
  console.log('ℹ️ This script is read-only. No migration/update/delete was performed.');
}

main().catch((error) => {
  console.error('❌ Dry-run failed:', error.message || error);
  process.exit(1);
});
