# LIVE-SCHEMA-DATA-REMEDIATION-V1 — GET-only next (Operator primary path)

```text
Path: 1 (adopted)
Primary: Operator signed-in GET → captures/ → capture identity fixed
Fallback: Cloud Agent signed-in GET (only if operator path unavailable)
Authority now: GET ONLY
Phase 4 mutation: NOT AUTHORIZED (Decision Pack form only)
```

## Why path 1

Critical path is **reliable signed-in live GET**. Operator browser on `/sites/welfare` yields higher Evidence quality and reproducibility than Cloud Agent auth (which can HOLD). Agent work in parallel is tooling only (Phase 3 Exit Checker + Decision Pack schema).

## Fixed execution order

```text
Operator:
  signed-in GET-only
  → raw JSON → captures/
  → capture identity fixed
Agent:
  capture ingest
  → classify
  → Evidence Pack regen
  → Decision Pack regen
  → Phase 3 exit判定
Human:
  Phase 3 PASS確認
  → Phase 4 TD+action単位 GO / HOLD
```

## Preconditions (already satisfied)

- [x] Baseline pinned (`acb5ec3f`)
- [x] Correction-3 mechanical bind in tooling
- [x] Required / core / quality PASS on Evidence Pack tip
- [x] Deep known-failure identity MATCH (not a blocker for this Gate)
- [x] Phase 3 Exit Checker + Decision Pack TD+action schema (tooling)

## Operator steps (signed-in `/sites/welfare`)

1. Confirm local `git rev-parse origin/main` still equals `BASELINE.json` `head` **or** update baseline first if main moved (stale Evidence prohibited).
2. Open site signed-in → DevTools Console.
3. Paste [`scripts/ops/live-schema-data-remediation-investigate.browser.js`](../../../scripts/ops/live-schema-data-remediation-investigate.browser.js).
4. Confirm dump includes:
   - `baselineHead === acb5ec3f97f7a1d7ee27c3ba0cf0a61f92894ee6`
   - `lists.*.listId` present
   - `contentSignificance` `{value,basis,evidence}` per item
5. Save raw JSON under `docs/evidence/live-schema-data-remediation-v1/captures/` (gitignored). Fix capture identity (`mode=browser-rest`, `liveCaptureStatus=CAPTURED`).
6. Classify (binds listIds into BASELINE on first CAPTURED; emits Phase 3 exit + Decision Pack JSON):

```bash
node scripts/ops/live-schema-data-remediation-classify.mjs \
  --input docs/evidence/live-schema-data-remediation-v1/captures/investigation-raw.json \
  --baseline docs/evidence/live-schema-data-remediation-v1/BASELINE.json \
  --out docs/evidence/live-schema-data-remediation-v1/DEFINITION_INVESTIGATION.json \
  --evidence-pack docs/evidence/live-schema-data-remediation-v1/EVIDENCE_PACK.json \
  --candidates docs/evidence/live-schema-data-remediation-v1/CANDIDATE_CLASSIFICATION.json \
  --decision-pack docs/evidence/live-schema-data-remediation-v1/DECISION_PACK.md \
  --decision-pack-json docs/evidence/live-schema-data-remediation-v1/DECISION_PACK.json \
  --phase3-exit docs/evidence/live-schema-data-remediation-v1/PHASE3_EXIT.json
```

7. Expect classify exit 0 only when `baselineVerification.result=PASS`, listIds `CAPTURED`→`BOUND`, and `phase3Exit=PASS`.
8. Phase 3: Independent Evidence Review via [`PHASE3_EXIT.md`](./PHASE3_EXIT.md) + [`DECISION_PACK.md`](./DECISION_PACK.md).
9. Phase 4: Human fills **Requested human action** + **Reviewer decision** per TD (never bulk GO). Case C → `SCHEMA RE-EVALUATION` | `HOLD` only.

## Phase 3 Exit Criteria (mechanical)

All must PASS (pack existence alone is insufficient):

| Check | Pass condition |
|---|---|
| baselineHead fixed | exact match to `BASELINE.json` |
| listIds captured | SupportRecord_Daily + DailyRecordRows CAPTURED/PASS (not PENDING) |
| TD-001…008 complete | all eight frozen groups present |
| contentSignificance | `value ∈ {TRUE,FALSE,UNKNOWN}` + `basis` + `evidence` per parent |
| Case A significance | `CASE_A_CANDIDATE` must not remain `UNKNOWN` unless schema-absent documented |
| classification traceable | candidate + lane + holdReasons |
| Case C separated | CASE_C → SCHEMA_CONTRACT_REASSESSMENT; `dataRemediationEligible=false` |
| unresolved ambiguity | count === 0 |
| source capture identity fixed | live browser capture (not rehydrate HOLD) |

Artifact: [`PHASE3_EXIT.json`](./PHASE3_EXIT.json)

## Phase 4 Decision Pack actions (form only)

```text
PRESERVE
DELETE GO
MERGE GO
SCHEMA RE-EVALUATION
HOLD
```

Per-TD blank slots (agent must not invent): Requested action · TargetItemIds · Expected post-state · Rollback · Reviewer decision · Rationale.

`DELETE GO` / `MERGE GO` prepare the Decision Pack **form** only — they do **not** grant mutation authority (`mutationAuthorityStatus=NOT_AUTHORIZED` until Human grants after Phase 3 PASS).

Case C rows: `SCHEMA RE-EVALUATION` | `HOLD` only (never DELETE / PRESERVE-as-delete).

## Operator dump status (this session)

```text
captures/investigation-raw.json: ABSENT
Live GET: HOLD
Evidence regenerate from live: BLOCKED
Tooling tip: LANDED (Phase 3 exit + Decision Pack TD+action)
Do not invent: listIds / contentSignificance / Human GO
```

Follow steps above when the operator drop arrives. Until then Phase 3 remains HOLD.

## Fail-closed

| Condition | Action |
|---|---|
| `baselineHead` null / mismatch | HOLD — do not review as fresh Evidence |
| listId mismatch vs BOUND baseline | HOLD |
| enumeration incomplete | HOLD |
| contentSignificance still UNKNOWN for Case A path | keep AMBIGUOUS — do not invent Case A |
| Phase 3 any check HOLD | do not fill Phase 4 Human GO |

## Prohibited until Phase 4 Human GO

Item delete/merge/Title rewrite · child reassignment · schema mutation · deploy · Schema Apply
