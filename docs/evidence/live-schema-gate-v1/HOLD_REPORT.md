# LIVE-SCHEMA-GATE-V1 HOLD

Read-only start after PR #2553 merged. Live Microsoft Lists column metadata was **not** confirmed. This report does **not** infer column presence or absence from repository provisioning.

## Verdict

```text
LIVE-SCHEMA-GATE-V1

Site Access:
PASS

List Schema Read:
BLOCKED BY AVAILABLE CONNECTOR CAPABILITY

Live Schema:
UNVERIFIED

Schema Mutation:
NONE

Deploy:
NOT AUTHORIZED

Gate:
HOLD
```

| Live item | Status |
|---|---|
| `SupportRecord_Daily.LatestVersion` | **UNVERIFIED** |
| `SupportRecord_Daily.LatestCommitId` | **UNVERIFIED** |
| `DailyRecordRows.CommitId` | **UNVERIFIED** |
| `SupportRecord_Daily.Title` Indexed + Unique | **UNVERIFIED** |

Do not treat UNVERIFIED as MISSING. Do not treat UNVERIFIED as PRESENT.

## Identities

| Item | Value |
|---|---|
| Persistence PR | [#2549](https://github.com/yasutakesougo/audit-management-system-mvp/pull/2549) merged as `15111c42` |
| Post-merge reconciliation PR | [#2553](https://github.com/yasutakesougo/audit-management-system-mvp/pull/2553) |
| #2553 source head | `eca87b6dfb37de3b8686331cf5423d6cf09965ce` |
| #2553 merge commit / `main` HEAD | `75beb6ab7c22033b3f5b6d07f3480e3ef5f8d4d5` |
| Merged at | 2026-08-27T06:52:48Z (15:52:48 JST) |
| Target site | `/sites/welfare` |
| Deploy | **NOT AUTHORIZED** |
| SharePoint mutation | **NONE** |

## Why live list schema is UNVERIFIED

Authenticated access to `/sites/welfare` succeeded. The connector available for that pass is document-library oriented (drive items). It cannot read Microsoft Lists column definitions, `Indexed`, or `EnforceUniqueValues`.

`SupportRecord_Daily` is a list, not a drive item, so a library-style share URL also cannot be used as a schema source.

Nightly `sp-schema-patrol` is log-file based, not a live Graph/REST fields GET. This Cloud Agent environment has no SharePoint credentials, so it did not call live fields APIs either.

## Repo contract vs provisioning (NOT live)

This table is the **code/repo** gap on `75beb6ab`. It is not a live SharePoint inventory.

| Contract | Code / tests | `daily.ts` `provisioningFields` | `DAILY_RECORD_CANONICAL_ENSURE_FIELDS` / rows ensure | `provision/schema.json` / `schema.xml` |
|---|---|---|---|---|
| Parent `LatestVersion` | resolver + saver + tests | **absent** | **absent** | **absent** |
| Parent `LatestCommitId` | same | **absent** | **absent** | **absent** |
| Child `Version` | saver + tests | present (`governance: allow`, silent) | not in rows ensure list | **absent** |
| Child `CommitId` | saver + tests | **absent** | **absent** | **absent** |
| Parent `Title` Indexed + `EnforceUniqueValues` | `DAILY_RECORD_PARENT_STORAGE_UNIQUENESS` | comment only | contract const only | **absent** for this list |

Until live inventory completes, runtime save against live lists must remain disabled. Missing live columns would fail closed (`$select` / POST schema errors → abort, no child DELETE). That is HOLD, not a license to guess.

## Correction-1 (P1-1) — inventory transport boundary

```text
LIVE-SCHEMA-GATE-V1 Correction-1
Browser REST:
GET-ONLY
Node SharePoint REST:
GET-ONLY
Microsoft Graph:
GET-ONLY
PnP PowerShell:
READ-ONLY
TRANSPORT METHOD NOT GUARANTEED
Schema Mutation:
PROHIBITED
```

Browser REST and Node REST pin `method: 'GET'` and refuse POST/PATCH/MERGE/DELETE. Graph inventory is also GET. PnP uses `Get-PnPList` / `Get-PnPField` (read-only cmdlets) over CSOM `ClientContext` / `ExecuteQueryRetry()`, so it is **not** HTTP GET-ONLY.

## Next Gate (inventory only)

Use these read inventory paths. Classify with `scripts/ops/live-schema-gate-inventory.mjs`. Schema mutation is **PROHIBITED** in this Gate.

1. **Browser REST (GET-ONLY; fastest if already signed in)**  
   Paste `scripts/ops/live-schema-gate-inventory.browser.js` into the SharePoint console on `/sites/welfare`. Save the JSON. Classify with `--mode file`.
2. **PnP PowerShell (READ-ONLY; transport method not guaranteed)**  
   `scripts/ops/live-schema-gate-inventory.ps1` (`Get-PnPField`). Do not call this GET-ONLY.
3. **SharePoint REST (GET-ONLY)**  
   `node scripts/ops/live-schema-gate-inventory.mjs --mode rest` with `SHAREPOINT_SITE` + `tests/.auth/storageState.json` or `SP_ACCESS_TOKEN`.
4. **Microsoft Graph (GET-ONLY)**  
   `--mode graph` with `GRAPH_ACCESS_TOKEN`. Confirms existence / type / Indexed. **Does not** expose `EnforceUniqueValues` on Graph v1.0 `columnDefinition`, so Title unique stays UNVERIFIED unless REST (GET-ONLY) or PnP (READ-ONLY) is used.
5. **SharePoint list settings UI**  
   List settings → columns. Record InternalName, type, Indexed, Enforce unique values. Do not change settings in this Gate.

Runbook: [`docs/runbooks/live-schema-gate-inventory.md`](../../runbooks/live-schema-gate-inventory.md)

After a complete inventory:

| Classifier gate | Meaning |
|---|---|
| `HOLD` | At least one check is still UNVERIFIED |
| `VERIFIED_GAPS` | All four checks were read; at least one is MISSING / MISMATCH / LIST_MISSING → **separate** schema mutation Gate |
| `VERIFIED_MATCH` | All four already match; mutation not required for these items |

Schema mutation and Deploy stay unauthorized until a later Gate. Correction-1 does not change the live HOLD / UNVERIFIED verdict.

## Machine-readable companion

[`HOLD_REPORT.json`](./HOLD_REPORT.json)
