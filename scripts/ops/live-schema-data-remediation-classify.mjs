#!/usr/bin/env node
/**
 * LIVE-SCHEMA-DATA-REMEDIATION-V1 — classify a GET-only investigation dump.
 *
 *   node scripts/ops/live-schema-data-remediation-classify.mjs \
 *     --input captures/investigation-raw.json \
 *     --out docs/evidence/live-schema-data-remediation-v1/DEFINITION_INVESTIGATION.json
 *
 * Writes a redacted report suitable for evidence (raw titles stripped).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { classifyDataRemediationInvestigation } from './live-schema-data-remediation/classify.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_OUT = resolve(
  REPO_ROOT,
  'docs/evidence/live-schema-data-remediation-v1/captures/DEFINITION_INVESTIGATION.json',
);

function parseArgs(argv) {
  const args = { input: null, out: DEFAULT_OUT, site: null };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--input' && value) { args.input = value; i += 1; }
    else if (key === '--out' && value) { args.out = resolve(value); i += 1; }
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) throw new Error('--input <investigation-json> is required');
  const dump = JSON.parse(readFileSync(resolve(args.input), 'utf8'));
  const classified = classifyDataRemediationInvestigation(dump);

  // Redacted evidence: drop raw titles from nested items
  const redactedGroups = (dump.duplicateGroups || []).map((group, index) => {
    const c = classified.groups[index];
    return {
      ...c,
      // keep item metadata without Title
      items: (group.items || []).map((item) => ({
        Id: item.Id,
        RecordDate: item.RecordDate ?? null,
        UserIdPresent: item.UserId != null && String(item.UserId).trim() !== '',
        Created: item.Created ?? null,
        Modified: item.Modified ?? null,
        childCount: item.childCount ?? 0,
        contentSignificanceVerified: item.contentSignificanceVerified === true,
        userRowsJSONPresent: item.userRowsJSONPresent === true,
        userCountPositive: item.userCountPositive === true
          || (item.userCount != null && Number(item.userCount) > 0),
        latestVersionPositive: item.latestVersionPositive === true
          || (item.latestVersion != null && Number(item.latestVersion) > 0),
      })),
    };
  });

  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: dump.generatedAt ?? null,
    siteUrl: dump.siteUrl ?? null,
    mode: dump.mode ?? 'file',
    httpMethods: dump.httpMethods ?? ['GET'],
    lists: dump.lists ?? null,
    titleStats: dump.titleStats ?? null,
    childRefsSummary: {
      ok: dump.childRefsSummary?.ok ?? null,
      parentIdField: dump.childRefsSummary?.parentIdField ?? dump.parentIdFieldUsed ?? null,
      rowsRead: dump.childRefsSummary?.rowsRead ?? null,
      enumerationComplete: dump.childRefsSummary?.enumerationComplete ?? null,
      // do not embed full byParentId map of all parents — only duplicate parents appear in groups
    },
    ...classified,
    groups: redactedGroups,
  };

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    id: report.id,
    definition: report.definition,
    readCompleteness: report.readCompleteness,
    duplicateGroupsAccounted: `${report.duplicateGroupsAccounted}/${report.expectedDuplicateGroups}`,
    emptyDuplicateCandidates: report.emptyDuplicateCandidates,
    activeDuplicates: report.activeDuplicates,
    ambiguousGroups: report.ambiguousGroups,
    schemaContractConflictCandidates: report.schemaContractConflictCandidates,
    dataMutation: report.dataMutation,
    out: args.out,
  }, null, 2));
  if (report.definition === 'HOLD' || report.readCompleteness === 'HOLD') process.exitCode = 2;
}

main();
