# LIVE-SCHEMA-DATA-REMEDIATION-V1 — GET-only next (Human Decision Pack path)

```text
After:
4bfedfed CI reconciliation + Correction-3 Evidence lock
Next:
signed-in One-shot GET-only Evidence Collection
Then:
Independent Evidence Review → Phase 4 Human Disposition GO/HOLD
Authority now:
GET ONLY
```

## Preconditions (already satisfied)

- [x] Baseline pinned (`acb5ec3f`)
- [x] Correction-3 mechanical bind in tooling
- [x] Required / core / quality PASS on Evidence Pack tip
- [x] Deep known-failure identity MATCH (not a blocker for this Gate)

## Operator steps (signed-in `/sites/welfare`)

1. Confirm local `git rev-parse origin/main` still equals `BASELINE.json` `head` **or** update baseline first if main moved (stale Evidence prohibited).
2. Open site signed-in → DevTools Console.
3. Paste [`scripts/ops/live-schema-data-remediation-investigate.browser.js`](../../../scripts/ops/live-schema-data-remediation-investigate.browser.js).
4. Confirm dump includes:
   - `baselineHead === acb5ec3f97f7a1d7ee27c3ba0cf0a61f92894ee6`
   - `lists.*.listId` present
   - `contentSignificance` `{value,basis,evidence}` per item
5. Save raw JSON under `docs/evidence/live-schema-data-remediation-v1/captures/` (gitignored).
6. Classify (binds listIds into BASELINE on first CAPTURED):

```bash
node scripts/ops/live-schema-data-remediation-classify.mjs \
  --input docs/evidence/live-schema-data-remediation-v1/captures/investigation-raw.json \
  --baseline docs/evidence/live-schema-data-remediation-v1/BASELINE.json \
  --out docs/evidence/live-schema-data-remediation-v1/DEFINITION_INVESTIGATION.json \
  --evidence-pack docs/evidence/live-schema-data-remediation-v1/EVIDENCE_PACK.json \
  --candidates docs/evidence/live-schema-data-remediation-v1/CANDIDATE_CLASSIFICATION.json \
  --decision-pack docs/evidence/live-schema-data-remediation-v1/DECISION_PACK.md
```

7. Expect classify exit 0 with `baselineVerification.result=PASS` and listIds `CAPTURED`→`BOUND`.
8. Phase 3: Independent Evidence Review of [`DECISION_PACK.md`](./DECISION_PACK.md).
9. Phase 4: fill **Human Decision** per row (never bulk GO). Case C → schema lane only.

## Fail-closed

| Condition | Action |
|---|---|
| `baselineHead` null / mismatch | HOLD — do not review as fresh Evidence |
| listId mismatch vs BOUND baseline | HOLD |
| enumeration incomplete | HOLD |
| contentSignificance still UNKNOWN for Case A path | keep AMBIGUOUS — do not invent Case A |

## Prohibited until Phase 4 Human GO

Item delete/merge/Title rewrite · child reassignment · schema mutation · deploy · Schema Apply
