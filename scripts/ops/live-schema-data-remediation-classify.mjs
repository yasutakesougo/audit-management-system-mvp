#!/usr/bin/env node
/**
 * LIVE-SCHEMA-DATA-REMEDIATION-V1 — classify a GET-only investigation dump.
 * Correction-2: emits Evidence Pack, Candidate Classification, Decision Pack.
 * Correction-3: loads BASELINE.json and mechanically binds baselineHead + listIds.
 * Phase 3: emits PHASE3_EXIT gate (ambiguity=0, listIds, significance, Case C).
 *
 * Operator signed-in GET is the primary capture path (raw JSON under captures/).
 * Cloud Agent login is fallback only.
 *
 *   node scripts/ops/live-schema-data-remediation-classify.mjs \
 *     --input captures/investigation-raw.json \
 *     --baseline docs/evidence/live-schema-data-remediation-v1/BASELINE.json \
 *     --out docs/evidence/live-schema-data-remediation-v1/DEFINITION_INVESTIGATION.json \
 *     --evidence-pack docs/evidence/live-schema-data-remediation-v1/EVIDENCE_PACK.json \
 *     --candidates docs/evidence/live-schema-data-remediation-v1/CANDIDATE_CLASSIFICATION.json \
 *     --decision-pack docs/evidence/live-schema-data-remediation-v1/DECISION_PACK.md \
 *     --phase3-exit docs/evidence/live-schema-data-remediation-v1/PHASE3_EXIT.json
 *
 * Exit code 2 when definition, baseline identity, or Phase 3 exit is HOLD.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  bindCapturedListIdsToBaseline,
  buildCandidateClassification,
  buildDecisionPack,
  buildDecisionPackMarkdown,
  buildEvidencePack,
  classifyDataRemediationInvestigation,
  evaluatePhase3Exit,
} from './live-schema-data-remediation/classify.mjs';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const EVIDENCE_DIR = resolve(REPO_ROOT, 'docs/evidence/live-schema-data-remediation-v1');
const DEFAULT_OUT = resolve(EVIDENCE_DIR, 'captures/DEFINITION_INVESTIGATION.json');
const DEFAULT_EVIDENCE_PACK = resolve(EVIDENCE_DIR, 'EVIDENCE_PACK.json');
const DEFAULT_CANDIDATES = resolve(EVIDENCE_DIR, 'CANDIDATE_CLASSIFICATION.json');
const DEFAULT_DECISION_PACK = resolve(EVIDENCE_DIR, 'DECISION_PACK.md');
const DEFAULT_DECISION_PACK_JSON = resolve(EVIDENCE_DIR, 'DECISION_PACK.json');
const DEFAULT_PHASE3_EXIT = resolve(EVIDENCE_DIR, 'PHASE3_EXIT.json');
const DEFAULT_BASELINE = resolve(EVIDENCE_DIR, 'BASELINE.json');

function parseArgs(argv) {
  const args = {
    input: null,
    baseline: DEFAULT_BASELINE,
    out: DEFAULT_OUT,
    evidencePack: DEFAULT_EVIDENCE_PACK,
    candidates: DEFAULT_CANDIDATES,
    decisionPack: DEFAULT_DECISION_PACK,
    decisionPackJson: DEFAULT_DECISION_PACK_JSON,
    phase3Exit: DEFAULT_PHASE3_EXIT,
    bindListIds: true,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === '--input' && value) { args.input = value; i += 1; }
    else if (key === '--baseline' && value) { args.baseline = resolve(value); i += 1; }
    else if (key === '--out' && value) { args.out = resolve(value); i += 1; }
    else if (key === '--evidence-pack' && value) { args.evidencePack = resolve(value); i += 1; }
    else if (key === '--candidates' && value) { args.candidates = resolve(value); i += 1; }
    else if (key === '--decision-pack' && value) { args.decisionPack = resolve(value); i += 1; }
    else if (key === '--decision-pack-json' && value) { args.decisionPackJson = resolve(value); i += 1; }
    else if (key === '--phase3-exit' && value) { args.phase3Exit = resolve(value); i += 1; }
    else if (key === '--no-bind-list-ids') { args.bindListIds = false; }
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

  let baseline = null;
  try {
    baseline = JSON.parse(readFileSync(args.baseline, 'utf8'));
  } catch (err) {
    console.error(JSON.stringify({
      error: 'BASELINE_LOAD_FAILED',
      baseline: args.baseline,
      detail: String(err && err.message ? err.message : err),
    }, null, 2));
    process.exitCode = 2;
  }

  const dump = JSON.parse(readFileSync(resolve(args.input), 'utf8'));
  let classified = classifyDataRemediationInvestigation(dump, { baseline });

  // Correction-3: bind first-capture listIds into BASELINE.json for subsequent runs
  let baselineBind = { changed: false };
  if (
    args.bindListIds
    && baseline
    && classified.baselineVerification
    && classified.baselineVerification.headResult === 'PASS'
    && classified.baselineVerification.listIdentityResult !== 'HOLD'
  ) {
    baselineBind = bindCapturedListIdsToBaseline(baseline, classified.baselineVerification);
    if (baselineBind.changed) {
      writeJson(args.baseline, baselineBind.baseline);
      baseline = baselineBind.baseline;
      classified = classifyDataRemediationInvestigation(dump, { baseline });
    }
  }

  // Redacted investigation report
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
    schemaVersion: 3,
    generatedAt: new Date().toISOString(),
    sourceGeneratedAt: dump.generatedAt ?? null,
    siteUrl: dump.siteUrl ?? null,
    mode: dump.mode ?? 'file',
    httpMethods: dump.httpMethods ?? ['GET'],
    baselinePath: args.baseline,
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

  const decisionPack = buildDecisionPack(classified, {
    evidencePackPath: 'docs/evidence/live-schema-data-remediation-v1/EVIDENCE_PACK.json',
    candidatesPath: 'docs/evidence/live-schema-data-remediation-v1/CANDIDATE_CLASSIFICATION.json',
    sourceGeneratedAt: dump.generatedAt ?? null,
  });
  writeJson(args.decisionPackJson, decisionPack);

  const phase3Exit = evaluatePhase3Exit(dump, classified, { baseline, evidencePack });
  writeJson(args.phase3Exit, phase3Exit);
  writeFileSync(
    args.phase3Exit.replace(/\.json$/i, '.md'),
    [
      '# LIVE-SCHEMA-DATA-REMEDIATION-V1 — Phase 3 Exit',
      '',
      '```text',
      `Result: ${phase3Exit.result}`,
      `Unresolved ambiguity: ${phase3Exit.unresolvedAmbiguityCount}`,
      'Mutation authority: NOT_AUTHORIZED',
      '```',
      '',
      '## Checks',
      '',
      ...Object.entries(phase3Exit.checks).map(
        ([id, c]) => `- **${id}**: ${c.result} — ${c.detail}`,
      ),
      '',
      phase3Exit.result === 'PASS'
        ? 'Human may proceed to Phase 4 TD+action GO/HOLD on Decision Pack.'
        : 'HOLD — operator signed-in GET / Evidence gaps must clear before Phase 4.',
      '',
    ].join('\n'),
    'utf8',
  );

  mkdirSync(dirname(args.decisionPack), { recursive: true });
  writeFileSync(
    args.decisionPack,
    buildDecisionPackMarkdown(decisionPack, { phase3Exit }),
    'utf8',
  );

  console.log(JSON.stringify({
    id: report.id,
    definition: report.definition,
    readCompleteness: report.readCompleteness,
    baselineVerification: {
      result: report.baselineVerification?.result ?? null,
      expectedHead: report.baselineVerification?.expectedHead ?? null,
      observedHead: report.baselineVerification?.observedHead ?? null,
      listIdentityResult: report.baselineVerification?.listIdentityResult ?? null,
    },
    baselineListIdsBound: baselineBind.changed === true,
    phase3Exit: phase3Exit.result,
    unresolvedAmbiguityCount: phase3Exit.unresolvedAmbiguityCount,
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
    decisionPackJson: args.decisionPackJson,
    phase3ExitPath: args.phase3Exit,
  }, null, 2));

  if (
    report.definition === 'HOLD'
    || report.readCompleteness === 'HOLD'
    || report.baselineVerification?.result === 'HOLD'
    || phase3Exit.result === 'HOLD'
  ) {
    process.exitCode = 2;
  }
}

main();
