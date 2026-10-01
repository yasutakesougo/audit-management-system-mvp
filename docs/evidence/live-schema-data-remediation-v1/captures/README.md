# LIVE-SCHEMA-DATA-REMEDIATION-V1 captures

Raw GET-only investigation dumps stay **local / gitignored**.

Committed redacted evidence lives in the parent folder:

- `EVIDENCE_PACK.json` / `CANDIDATE_CLASSIFICATION.json` / `DECISION_PACK.md`
- `DEFINITION*.md/json` / `CAPTURE_STATUS.md` / `PROCESS.md` / `BASELINE.json`

Never commit cookies, tokens, or unnecessary PII.

## One-shot capture (Phase 1)

1. Confirm `BASELINE.json` HEAD
2. Sign in on `/sites/welfare`
3. Paste `scripts/ops/live-schema-data-remediation-investigate.browser.js`
4. Save raw JSON here (gitignored)
5. Classify:

```bash
node scripts/ops/live-schema-data-remediation-classify.mjs \
  --input docs/evidence/live-schema-data-remediation-v1/captures/investigation-raw.json \
  --out docs/evidence/live-schema-data-remediation-v1/DEFINITION_INVESTIGATION.json \
  --evidence-pack docs/evidence/live-schema-data-remediation-v1/EVIDENCE_PACK.json \
  --candidates docs/evidence/live-schema-data-remediation-v1/CANDIDATE_CLASSIFICATION.json \
  --decision-pack docs/evidence/live-schema-data-remediation-v1/DECISION_PACK.md
```
