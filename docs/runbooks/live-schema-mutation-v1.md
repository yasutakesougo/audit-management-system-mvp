# LIVE-SCHEMA-MUTATION-V1

Minimal SharePoint schema changes for DAILY-RECORD-PERSISTENCE-V1 live gaps.  
**Definition is not Apply.** Mutation Authority stays **NOT YET AUTHORIZED** until Human GO.

## Phases

| Phase | Purpose | SharePoint writes |
|---|---|---|
| **Definition** | Freeze required changes, preflight, fail-closed, apply order | **NONE** |
| **Review** | Human review of Definition + preflight evidence | **NONE** |
| **Human GO** | Explicit authorize Apply | **NONE** |
| **Apply** | Execute the four changes only | Allowed **only after GO** |
| **Verify** | Re-run LIVE-SCHEMA-GATE-V1 → expect `VERIFIED_MATCH` | GET-only inventory |

## Required changes

1. `SupportRecord_Daily.LatestVersion` — add **Number**  
2. `SupportRecord_Daily.LatestCommitId` — add **Text**  
3. `DailyRecordRows.CommitId` — add **Text**  
4. `SupportRecord_Daily.Title` — confirm `Indexed=true` first, then set `EnforceUniqueValues=true` (never unique while Indexed is false)

## Preflight (GET / READ-ONLY)

Preferred: signed-in browser on `/sites/welfare`.

```text
1. Paste scripts/ops/live-schema-mutation-preflight.browser.js into DevTools Console
2. Save printed JSON (no cookies/tokens)
3. Classify:
```

```bash
node scripts/ops/live-schema-mutation-preflight.mjs \
  --mode file \
  --input path/to/preflight-dump.json \
  --out docs/evidence/live-schema-mutation-v1/captures/PREFLIGHT.json
```

Node REST (GET-only) when `SP_ACCESS_TOKEN` or Playwright `storageState` already exists **locally** (do not paste secrets into chat/GitHub):

```bash
export SHAREPOINT_SITE="https://isogokatudouhome.sharepoint.com/sites/welfare"
node scripts/ops/live-schema-mutation-preflight.mjs --mode rest
```

### Preflight must report

- List found for `SupportRecord_Daily` / `DailyRecordRows`
- Presence of `LatestVersion` / `LatestCommitId` / `CommitId`
- `Title` Indexed + EnforceUniqueValues
- ItemCount per list
- Title duplicate group count
- Title null/blank count
- Title enumeration completeness (`itemRowsRead === ItemCount`)
- `preflightGate`: `READY` | `HOLD`

### Fail-closed (HOLD — do not Apply)

- Title duplicate groups `> 0`
- Title null/blank count `> 0` (**Correction-1 P1-1**)
- Title/Id enumeration incomplete (**Correction-1 P1-2**)
- Schema drift / incompatible existing field type
- List missing or ambiguous
- Auth/permission failure

**Do not** auto-repair duplicate or blank Titles in this Gate.  
Title duplicate remediation is a separate Gate: [`live-schema-data-remediation-v1.md`](./live-schema-data-remediation-v1.md).

## Correction-1

```text
LIVE-SCHEMA-MUTATION-V1
Definition Correction-1
Fix:
P1-1 blank Title fail-closed
P1-2 enumeration completeness fail-closed
P2-1 index-before-unique wording
SharePoint mutation:
NONE
Duplicate remediation:
NONE
Deploy:
NOT AUTHORIZED
```

**P2-1 wording:** Confirm `Title.Indexed=true` (re-read) **before** setting `Title.EnforceUniqueValues=true`. Never enable unique while Indexed is false.

## Apply (blocked until Human GO)

Documented order only — scripts that mutate must refuse to run without an explicit `--i-authorize-mutation` style flag **and** documented Human GO evidence. Definition/preflight tooling must never Add/Set fields.

Order when authorized:

1. Re-run preflight → must be `READY`  
2. Add three columns  
3. Set `Title.Indexed=true`, re-read, confirm Indexed  
4. Set `Title.EnforceUniqueValues=true`  
5. LIVE-SCHEMA-GATE inventory → `VERIFIED_MATCH`

## Prohibited

- Item rewrite / backfill / migration  
- Delete  
- Deploy  
- Persistence runtime activation  
- Duplicate / blank Title automatic repair  
- Unrelated schema edits  
- Calling this Gate “complete” after Definition alone  

## Evidence layout

```text
docs/evidence/live-schema-mutation-v1/
  DEFINITION.md
  DEFINITION.json
  captures/          # gitignored live dumps
```

## Related

- Gate inventory: `docs/runbooks/live-schema-gate-inventory.md`
- ADR-025: `docs/adr/ADR-025-daily-record-persistence-v1.md`
- Index-before-unique pattern: `scripts/provision-spo.ps1` `Set-ListFieldSafe`
