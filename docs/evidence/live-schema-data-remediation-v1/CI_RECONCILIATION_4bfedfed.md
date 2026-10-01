# LIVE-SCHEMA Evidence Pack — CI Reconciliation (`4bfedfed`)

```text
Exact Head:
4bfedfeda1c0a5325b0e671608d2794d473e3449

PR:
#2558

Baseline HEAD (Phase 0):
acb5ec3f97f7a1d7ee27c3ba0cf0a61f92894ee6

CI Terminal:
YES

Required / Core / Quality:
PASS

E2E Deep:
EXPECTED RED (known-failure identity MATCH vs main)

Verdict:
CORRECTION-3 EVIDENCE LOCKABLE
→ next: signed-in GET-only one-shot Evidence regenerate
→ not Phase 4 / not item mutation / not Schema Apply
```

## Required / core / quality

| Lane | Result |
|---|---|
| Core API Contracts | PASS |
| CI Preflight (Aggregator) | PASS |
| quality | PASS |
| canary | PASS |
| fast / smoke | PASS |
| CSP / kiosk / sb-a11y / schedule | PASS |
| Unit / Typecheck / Lint | PASS |
| e2e-smoke (nurse) | PASS |
| Deep Lane Union Audit | PASS |
| Required failed | **0** |
| Required pending | **0** |

Check-runs on exact head: **50** total · **41** success · **6** failure · **3** skipped.  
All 6 failures are E2E Deep Chromium lanes (below).

## Deep known-failure identity

Compared exact-head Deep run vs `main` @ Phase 0 baseline `acb5ec3f`:

| Item | PR tip `4bfedfed` | `main` `acb5ec3f` |
|---|---|---|
| Deep run | [33227980166](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/33227980166) | [33228467614](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/33228467614) |
| Chromium lanes failed | 6/6 | 6/6 |
| Lane set | app-a11y, fixture-memory, general, implementation-hot, sp-stub, transport-date-check | **identical** |
| JUnit failure keys | **34** | **34** |
| Key identity | **34/34 identical** · only_pr=0 · only_main=0 | — |
| Deep Lane Union Audit | **PASS** | (same workflow pattern) |

```text
Deep failure identity:
MATCH
New Deep failures introduced by #2558:
NONE
Classification:
EXPECTED RED (baseline) — unrelated to Evidence Pack / Correction-3
```

Machine list: [`deep-failure-keys-4bfedfed.json`](./deep-failure-keys-4bfedfed.json)

## Correction-3 Evidence lock

| Artifact | Status |
|---|---|
| `BASELINE.json` | LOCKED (`head=acb5ec3f…`) |
| `PROCESS.md` Correction-3 | LOCKED |
| classify `verifyBaselineIdentity` | LOCKED in tip |
| `EVIDENCE_PACK.json` `baselineVerification` | PASS (head bound; listIds PENDING_CAPTURE) |
| Live SharePoint GET | HOLD (no session in Cloud Agent) |
| Human Decision | blank (Phase 4 not started) |

## Authority (unchanged)

```text
SharePoint item mutation: NOT AUTHORIZED
Schema mutation:          NOT AUTHORIZED
Schema Apply:             NOT AUTHORIZED
Deploy:                   NOT AUTHORIZED
Human Disposition GO:     NOT STARTED
```

## Next

1. Signed-in browser **GET-only** one-shot (`investigate.browser.js` with pinned `baselineHead`)
2. Classify → regenerate Evidence Pack / Candidates / Decision Pack (Correction-3 bind listIds)
3. Independent Evidence Review (Phase 3)
4. Phase 4 Human Disposition GO/HOLD per row — Case C → schema lane
