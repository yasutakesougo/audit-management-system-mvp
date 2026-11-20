# LIVE-SCHEMA Evidence Pack — CI Reconciliation (`894ed93a`)

```text
Exact Head:
894ed93ad057c637d6d5531dbdee70866dcbdb1d

PR:
#2558

Baseline HEAD (Phase 0):
acb5ec3f97f7a1d7ee27c3ba0cf0a61f92894ee6

CI Terminal:
YES

Required / Core / Quality:
PASS

E2E Deep:
EXPECTED RED (known-failure identity MATCH vs 4bfedfed lock / main)

Verdict:
PHASE3 TOOLING CI OK
→ next: Operator signed-in GET-only → captures/
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

Compared exact-head Deep run vs locked Evidence tip `4bfedfed` (itself **34/34** vs `main@acb5ec3f`):

| Item | PR tip `894ed93a` | Prior lock `4bfedfed` |
|---|---|---|
| Deep run | [33231137497](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/33231137497) | [33227980166](https://github.com/yasutakesougo/audit-management-system-mvp/actions/runs/33227980166) |
| Chromium lanes failed | 6/6 | 6/6 |
| Lane set | app-a11y, fixture-memory, general, implementation-hot, sp-stub, transport-date-check | **identical** |
| JUnit failure keys | **34** | **34** |
| Key identity | **34/34 identical** · only_pr=0 · only_prior=0 | — |
| Deep Lane Union Audit | **PASS** | PASS |

```text
Deep failure identity:
MATCH
New Deep failures introduced by Phase 3 tooling commit:
NONE
Classification:
EXPECTED RED (baseline) — unrelated to Phase 3 Exit / Decision Pack schema
```

Machine list: [`deep-failure-keys-894ed93a.json`](./deep-failure-keys-894ed93a.json)

## Phase 3 tooling (this tip)

| Artifact | Status |
|---|---|
| `evaluatePhase3Exit` | READY |
| `PHASE3_EXIT.json` (rehydrate) | HOLD (listIds PENDING, ambiguity=4, capture HOLD) |
| `DECISION_PACK.json` | Form only; `NOT_AUTHORIZED` |
| Live SharePoint GET | HOLD — Operator primary path |
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

1. Operator signed-in browser **GET-only** → raw JSON under `captures/` ([GET_ONLY_NEXT.md](./GET_ONLY_NEXT.md))
2. Agent: classify → Evidence / Decision Pack / Phase 3 exit regen
3. Human: Phase 3 PASS → Phase 4 TD+action GO/HOLD
