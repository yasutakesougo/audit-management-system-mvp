# SupportCase App-Test Diagnostics Result - 2026-06-09

## Scope

This report records the first approved app-test read-only diagnostics command for experimental SupportCase SharePoint definitions.

No app-test or production SharePoint list, library, permission, folder, file, item, migration, UI integration, Graph API change, `spFetch` change, or `SupportCaseRepository` change was made.

## Preconditions Confirmed

- PR #2142 was merged.
- PR #2144 was merged.
- Local branch before execution: `main`.
- `main` and `origin/main` were aligned before execution.
- Working tree was clean before execution.
- Target URL: `https://isogokatudouhome.sharepoint.com/sites/app-test`
- Production status: confirmed by human review as not production.
- Opt-in flag used only inline for the opt-in command: `VITE_FEATURE_SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS=1`

## Read-Only Safety Check

The diagnostics test inspected for this run uses SharePoint REST `GET` requests only:

- `/_api/web/currentuser`
- `/_api/web/lists/GetByTitle(...)?$select=Title,Id,Hidden,HasUniqueRoleAssignments,BaseTemplate`
- `/_api/web/lists/GetByTitle(...)/items?$select=Id&$top=1`
- `/_api/web/lists/GetByTitle(...)/fields?$select=InternalName,Title,TypeAsString,Hidden,ReadOnlyField`

No create, ensure, provision, bootstrap, migrate, upload, permission, or delete command was run.

## Default Diagnostics

Command:

```bash
SHAREPOINT_SITE=https://isogokatudouhome.sharepoint.com/sites/app-test npm run ci:integration:diagnose
```

Result:

- Passed.
- Current user endpoint returned HTTP 200.
- `Staff_Master` metadata endpoint returned HTTP 200.
- `Staff_Master` items endpoint returned HTTP 200.
- SupportCase experimental diagnostics test was skipped because `VITE_FEATURE_SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS=1` was not set.
- `support_case_*` targets were not included without opt-in.
- No SharePoint resource was created, changed, or deleted.

## Opt-In Diagnostics

Command:

```bash
SHAREPOINT_SITE=https://isogokatudouhome.sharepoint.com/sites/app-test VITE_FEATURE_SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS=1 npm run ci:integration:diagnose
```

Result:

- Passed as a diagnostics run.
- Current user endpoint returned HTTP 200.
- `Staff_Master` metadata endpoint returned HTTP 200.
- `Staff_Master` items endpoint returned HTTP 200.
- SupportCase experimental diagnostics test ran with opt-in.
- Opt-in targets were:
  - `SupportCases`
  - `SupportCaseDocuments`
  - `SupportCaseEvents`
  - `SupportCaseRestrictedDocuments`

SupportCase target results:

| Target | HTTP status | Result |
|---|---:|---|
| `support_cases` / `SupportCases` | 404 | List/library was not found at the app-test site. |
| `support_case_documents` / `SupportCaseDocuments` | 403 | Access denied for metadata read. |
| `support_case_events` / `SupportCaseEvents` | 403 | Access denied for metadata read. |
| `support_case_restricted_documents` / `SupportCaseRestrictedDocuments` | 403 | Access denied for metadata read. |

Because metadata reads did not succeed for the SupportCase targets, field-level diagnostics were not reached for those resources.

## Interpretation

- Default exclusion is confirmed: SupportCase diagnostics were skipped without opt-in.
- Opt-in target selection is confirmed: all four SupportCase targets appeared only when `VITE_FEATURE_SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS=1` was set.
- The run did not confirm app-test field presence because the SupportCase target metadata reads returned 404 or 403.
- The run did not confirm `SupportCaseRestrictedDocuments` `BaseTemplate` from SharePoint because its metadata read returned 403.
- No new SharePoint resource was created or changed to resolve the 404 or 403 responses.
- No permission change was made to resolve the 403 responses.

## Stop Condition Review

- Production URL suspected: no.
- `support_case_*` appeared without opt-in: no.
- Create/provision/bootstrap/migrate command required: no command was run; any such next step remains out of scope.
- SharePoint permission change required: not performed. The 403 findings require human review before any permission planning.
- App-test resource creation required: not performed. The 404 finding requires human review before any creation planning.
- `.env`, token, secret, `.vscode/settings.json`, or `nvidia-nim-probe/` changes: none.

## Next Action

Stop at this result record. Review the app-test 404/403 findings before deciding whether to plan any separate app-test creation or permission review work.

Do not create app-test lists or libraries, change permissions, connect UI, migrate documents, add Graph API or `spFetch` communication, or change `SupportCaseRepository` behavior as part of this diagnostics result.
