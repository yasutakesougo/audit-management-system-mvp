#!/usr/bin/env node
/**
 * LIVE-SCHEMA-DATA-REMEDIATION-V1 — classify a GET-only investigation dump.
 * Correction-2: also emits Evidence Pack, Candidate Classification, Decision Pack.
 *
 *   node scripts/ops/live-schema-data-remediation-classify.mjs \
 *     --input captures/investigation-raw.json \
 *     --out docs/evidence/live-schema-data-remediation-v1/DEFINITION_INVESTIGATION.json \
 *     --evidence-pack docs/evidence/live-schema-data-remediation-v1/EVIDENCE_PACK.json \
 *     --candidates docs/evidence/live-schema-data-remediation-v1/CANDIDATE_CLASSIFICATION.json \
 *     --decision-pack docs/evidence/live-schema-data-remediation-v1/DECISION_PACK.md
 *
 * Writes redacted reports suitable for evidence (raw titles stripped).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildCandidateClassification,
  buildDecisionPackMarkdown,
  buildEvidencePack,
  classifyDataRemediationInvestigation,
} from './live-schema-data-remediation/classify.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const EVIDENCE_DIR = resolve(REPO_ROOT, 'docs/evidence/live-schema-data-remediation-v1');
const DEFAULT_OUT = resolve(EVIDENCE_DIR, 'captures/DEFINITION_INVESTIGATION.json');
const DEFAULT_EVIDENCE_PACK = resolve(EVIDENCE_DIR, 'EVIDENCE_PACK.json');
const DEFAULT_CANDIDATES = resolve(EVIDENCE_DIR, 'CANDIDATE_CLASSIFICATION.json');
const DEFAULT_DECISION_PACK = resolve(EVIDENCE_DIR, 'DECISION_PACK.md');

function parseArgs(argv) {
  const args = {
    input: null,
    out: DEFAULT_OUT,
    evidencePack: DEFAULT_EVIDENCE_PACK,
    candidates: DEFAULT_CANDIDATES,
    decisionPack: DEFAULT_DECISION_PACK,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--input' && value) { args.input = value; i += 1; }
    else if (key === '--out' && value) { args.out = resolve(value); i += 1; }
    else if (key === '--evidence-pack' && value) { args.evidencePack = resolve(value); i += 1; }
    else if (key === '--candidates' && value) { args.candidates = resolve(value); i += 1; }
    else if (key === '--decision-pack' && value) { args.decisionPack = resolve(value); i += 1; }
  }
  return args;
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input) throw new Error('--input <investigation-json> is required');
  const dump = JSON.parse(readFileSync(resolve(args.input), 'utf8'));
  const classified = classifyDataRemediationInvestigation(dump);

  // Redacted investigation report (Correction-1 compatible + Correction-2 fields)
  const redactedGroups = classified.groups.map((c) => {
    const raw = (dump.duplicateGroups || []).find((g) => {
      const ids = g.parentItemIds || (g.items || []).map((it) => it.Id);
      return JSON.stringify([...(ids || [])].map(Number).sort((a, b) => a - b))
        === JSON.stringify([...(c.parentItemIds || [])].map(Number).sort((a, b) => a - b));
    });
    return {
      ...c,
      items: ((raw && raw.items) || []).map((item) => ({
        Id: item.Id,
        RecordDate: item.RecordDate ?? null,
        UserIdPresent: item.UserId != null && String(item.UserId).trim() !== '',
        Created: item.Created ?? null,
        Modified: item.Modified ?? null,
        AuthorId: item.AuthorId ?? null,
        AuthorTitlePresent: item.AuthorTitlePresent === true,
        EditorId: item.EditorId ?? null,
        EditorTitlePresent: item.EditorTitlePresent === true,
        lifecycle: item.lifecycle ?? { status: 'UNKNOWN' },
        archival: item.archival ?? { status: 'NOT_PROBED' },
        schemaRelevant: item.schemaRelevant ?? {},
        childCount: item.childCount ?? 0,
        contentSignificanceVerified: item.contentSignificanceVerified === true,
        userRowsJSONPresent: item.userRowsJSONPresent === true,
        userCountPositive: item.userCountPositive === true
          || (item.userCount != null && Number(item.userCount) > 0),
        latestVersionPositive: item.latestVersionPositive === true
          || (item.latestVersion != null && Number(item.latestVersion) > 0),
        contentSignificance: item.contentSignificance ?? null,
      })),
    };
  });

  const report = {
    schemaVersion: 2,
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
    },
    ...classified,
    groups: redactedGroups,
  };

  writeJson(args.out, report);

  const evidencePack = buildEvidencePack(dump, classified);
  writeJson(args.evidencePack, evidencePack);

  const candidates = buildCandidateClassification(classified);
  writeJson(args.candidates, candidates);

  mkdirSync(dirname(args.decisionPack), { recursive: true });
  writeFileSync(args.decisionPack, buildDecisionPackMarkdown(candidates), 'utf8');

  console.log(JSON.stringify({
    id: report.id,
    definition: report.definition,
    readCompleteness: report.readCompleteness,
    duplicateGroupsAccounted: `${report.duplicateGroupsAccounted}/${report.expectedDuplicateGroups}`,
    caseACandidates: report.caseACandidates,
    caseBCandidates: report.caseBCandidates,
    caseCCandidates: report.caseCCandidates,
    ambiguousGroups: report.ambiguousGroups,
    contentSignificanceCapture: report.contentSignificanceCapture,
    dataMutation: report.dataMutation,
    out: args.out,
    evidencePack: args.evidencePack,
    candidates: args.candidates,
    decisionPack: args.decisionPack,
  }, null, 2));
  if (report.definition === 'HOLD' || report.readCompleteness === 'HOLD') process.exitCode = 2;
}

main();
