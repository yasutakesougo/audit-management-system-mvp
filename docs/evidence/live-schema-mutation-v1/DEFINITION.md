# LIVE-SCHEMA-MUTATION-V1 — Definition

```text
LIVE-SCHEMA-MUTATION-V1
Phase:
Definition
Mutation Authority:
NOT YET AUTHORIZED
Deploy:
NOT AUTHORIZED
```

Close the four live schema gaps found by **LIVE-SCHEMA-GATE-V1 (`VERIFIED_GAPS`)** for **DAILY-RECORD-PERSISTENCE-V1**, using the smallest non-destructive SharePoint field changes. This phase **defines** the change set, preflight, fail-closed rules, and apply order. It does **not** mutate SharePoint and does **not** deploy.

## Source of truth (live)

| Item | LIVE-SCHEMA-GATE-V1 |
|---|---|
| Site | `https://isogokatudouhome.sharepoint.com/sites/welfare` |
| Gate | `VERIFIED_GAPS` |
| Path | Browser REST **GET-ONLY** |
| `SupportRecord_Daily.LatestVersion` | **MISSING** |
| `SupportRecord_Daily.LatestCommitId` | **MISSING** |
| `DailyRecordRows.CommitId` | **MISSING** |
| `SupportRecord_Daily.Title` Indexed + Unique | **PRESENT_MISMATCH** (`Indexed=false`, `EnforceUniqueValues=false`) |

Classifier evidence (local capture; gitignored): `docs/evidence/live-schema-gate-v1/captures/LIVE_SCHEMA_INVENTORY.json`  
Contracts: ADR-025, `DAILY_RECORD_PARENT_STORAGE_UNIQUENESS`, `scripts/ops/live-schema-gate/classify.mjs`

## Required changes (minimal)

| # | List | Change | InternalName | Type / flags |
|---|---|---|---|---|
| 1 | `SupportRecord_Daily` | **AddField** | `LatestVersion` | Number |
| 2 | `SupportRecord_Daily` | **AddField** | `LatestCommitId` | Text |
| 3 | `DailyRecordRows` | **AddField** | `CommitId` | Text |
| 4 | `SupportRecord_Daily` | **SetFieldFlags** | `Title` | `Indexed=true` **then** `EnforceUniqueValues=true` |

Primary InternalNames match the first candidates in `dailyFields.ts`. Do not create `cr013_*` aliases in this Gate.

## Mandatory preflight (before any Apply)

Read-only only (`GET` / PnP `Get-*`). Capture under `docs/evidence/live-schema-mutation-v1/captures/` (gitignored).

1. Target lists exist (exactly one `SupportRecord_Daily`, one `DailyRecordRows`).
2. The three add-columns are still absent (or HOLD on incompatible existing type).
3. `SupportRecord_Daily` **Title duplicate count** (string equality on `Title`).
4. `SupportRecord_Daily` **Title null/blank count**.
5. Item counts for both lists.
6. Current field schema snapshot (`InternalName`, `TypeAsString`, `Indexed`, `EnforceUniqueValues`).
7. Rollback evidence = that snapshot + preflight JSON (no cookies/tokens/PII beyond date-like Titles).

Tooling: `scripts/ops/live-schema-mutation-preflight.browser.js` → classify with `scripts/ops/live-schema-mutation-preflight.mjs`.

## Fail-closed → HOLD (no Apply)

| Condition | Action |
|---|---|
| Title duplicate groups `> 0` | **HOLD** — no automatic repair |
| Unexpected schema drift vs Gate baseline | **HOLD** |
| List title ambiguous / missing | **HOLD** |
| Permission insufficient | **HOLD** |
| Candidate field exists with incompatible type | **HOLD** |

## Prohibited (all phases of this Gate unless a later Human GO explicitly says otherwise)

- Existing item rewrite  
- Migration / backfill  
- Delete (lists / items / populated fields)  
- Deploy  
- Persistence runtime activation  
- Duplicate Title automatic repair  
- Unrelated schema changes  

## Apply order (only after Review + Human GO)

1. Re-run preflight. Abort on any fail-closed hit.  
2. Add `LatestVersion` (Number).  
3. Add `LatestCommitId` (Text).  
4. Add `CommitId` (Text) on `DailyRecordRows`.  
5. Set `Title.Indexed = true`.  
6. Set `Title.EnforceUniqueValues = true` (requires step 5 + zero Title duplicates).  
7. Re-run LIVE-SCHEMA-GATE-V1 inventory; require `VERIFIED_MATCH`.

Indexed **before** unique (same rule as `Set-ListFieldSafe` in `scripts/provision-spo.ps1`).

## Authority

| Gate | Status |
|---|---|
| Definition (this document) | **ACTIVE** |
| Review | pending |
| Human GO | pending |
| Mutation Apply | **NOT YET AUTHORIZED** |
| Deploy | **NOT AUTHORIZED** |
| Persistence runtime activation | **NOT AUTHORIZED** |

## Preflight execution (Definition-time, GET-only)

Executed on `/sites/welfare` via Browser REST **GET-only** (field snapshot + `Title`/`Id` enumeration). No schema mutation.

| Check | Result |
|---|---|
| `SupportRecord_Daily` found | PASS (ItemCount **359**) |
| `DailyRecordRows` found | PASS (ItemCount **3868**) |
| `LatestVersion` / `LatestCommitId` / `CommitId` still absent | PASS (still MISSING) |
| `Title` Indexed + Unique | still `false` / `false` (PRESENT_MISMATCH) |
| Title null/blank count | **0** |
| Title duplicate groups | **8** → **fail-closed HOLD** |
| Preflight gate | **HOLD** |
| Mutation Authority | **NOT YET AUTHORIZED** |

Captures (gitignored): `captures/preflight-browser-dump.json`, `captures/PREFLIGHT.json`, `captures/preflight-title-stats.json`.

**Implication:** Even after Review / Human GO, Apply must remain blocked until Title duplicate groups are **0**. This Gate does **not** auto-repair duplicates; resolution is a separate human data decision.

## Next

1. **Review** this Definition + preflight HOLD (`TITLE_DUPLICATES`).  
2. Human resolves Title duplicates **outside** this Gate (no automatic repair here).  
3. Re-run preflight until `preflightGate=READY`.  
4. **Human GO** required before Apply.  
5. Do not Apply while Authority is NOT YET AUTHORIZED.

Machine-readable companion: [`DEFINITION.json`](./DEFINITION.json)  
Runbook: [`docs/runbooks/live-schema-mutation-v1.md`](../../runbooks/live-schema-mutation-v1.md)
