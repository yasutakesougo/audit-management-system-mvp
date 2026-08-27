# LIVE-SCHEMA-GATE-V1 — read-only schema inventory

Confirm live SharePoint list columns **before** any schema mutation. This Gate never Add/Set/Remove fields and never deploys.

Target site: `https://isogokatudouhome.sharepoint.com/sites/welfare`

## Four checks

| id | List | What to read |
|---|---|---|
| `SupportRecord_Daily.LatestVersion` | `SupportRecord_Daily` | exists; type `Number`; candidates `LatestVersion` / `latestVersion` / `cr013_latestVersion` |
| `SupportRecord_Daily.LatestCommitId` | `SupportRecord_Daily` | exists; type `Text`; candidates `LatestCommitId` / `latestCommitId` / `cr013_latestCommitId` |
| `DailyRecordRows.CommitId` | `DailyRecordRows` | exists; type `Text`; candidates `CommitId` / `commitId` / `cr013_commitId` |
| `SupportRecord_Daily.Title.indexedUnique` | `SupportRecord_Daily` | `Title` has `Indexed=true` **and** `EnforceUniqueValues=true` |

UNVERIFIED means the API did not return the fact. Do not infer MISSING from the repo.

## Path A — browser REST (recommended if already signed in)

1. Open `/sites/welfare` in the browser.
2. DevTools console → paste `scripts/ops/live-schema-gate-inventory.browser.js`.
3. Save the printed JSON (no secrets; field metadata only).
4. Classify:

```bash
node scripts/ops/live-schema-gate-inventory.mjs \
  --mode file \
  --input path/to/dump.json \
  --out docs/evidence/live-schema-gate-v1/captures/LIVE_SCHEMA_INVENTORY.json
```

HTTP method: **GET** `/_api/web/lists/getbytitle('...')/fields?$select=InternalName,Title,TypeAsString,Indexed,EnforceUniqueValues,Hidden,ReadOnlyField`

## Path B — PnP PowerShell

```powershell
Install-Module PnP.PowerShell -Scope CurrentUser
.\scripts\ops\live-schema-gate-inventory.ps1 `
  -SiteUrl "https://isogokatudouhome.sharepoint.com/sites/welfare" `
  -UseWebLogin
```

Uses `Get-PnPList` / `Get-PnPField` only. Mutating cmdlets are stubbed to throw.

## Path C — SharePoint REST from Node

Requires `SHAREPOINT_SITE` and either `tests/.auth/storageState.json` or `SP_ACCESS_TOKEN`.

```bash
export SHAREPOINT_SITE="https://isogokatudouhome.sharepoint.com/sites/welfare"
node scripts/ops/live-schema-gate-inventory.mjs --mode rest
```

## Path D — Microsoft Graph

```bash
export GRAPH_ACCESS_TOKEN="..."
node scripts/ops/live-schema-gate-inventory.mjs --mode graph
```

Graph v1.0 `columnDefinition` exposes `name`, type, and `indexed`. It does **not** expose `EnforceUniqueValues`. Title unique therefore stays **UNVERIFIED** on Graph-only dumps. Re-run Path A/B/C for that one flag.

## Path E — list settings UI

1. Site contents → `SupportRecord_Daily` → List settings → columns.
2. Record whether `LatestVersion` and `LatestCommitId` exist, and their types.
3. Open `Title` → note **Indexed** and **Enforce unique values**. Do not tick them in this Gate.
4. Repeat for `DailyRecordRows` → `CommitId`.
5. Transcribe into the dump JSON `lists.*.fields` shape and classify with `--mode file`.

## Classifier exits

| `gate` | Meaning | Next |
|---|---|---|
| `HOLD` (exit 2) | At least one UNVERIFIED | Finish inventory |
| `VERIFIED_GAPS` (exit 0) | All four were read; gaps exist | Separate schema mutation Gate (still no apply until authorized) |
| `VERIFIED_MATCH` (exit 0) | All four match | Mutation not required for these items |

`--mode hold` writes UNVERIFIED evidence without calling SharePoint (exit 2). Use it when credentials are absent.

## Still forbidden in this Gate

- `Add-PnPField` / `Set-PnPField` / `New-PnPList` / item POST-PATCH-DELETE
- `provision-apply` / workflow rerun / Deploy
- Inferring live MISSING from `src/sharepoint/definitions/daily.ts`
