# SupportCase App-Test Diagnostics Execution Plan - 2026-06-09

## Purpose

This plan defines the go/no-go gate for the first app-test SupportCase diagnostics command that may read SharePoint metadata.

It does not approve SharePoint list or library creation. It does not approve permission changes, UI integration, migration, file upload, Graph API changes, `spFetch` changes, or `SupportCaseRepository` behavior changes.

## Current Status

- App-test target URL confirmed: `https://isogokatudouhome.sharepoint.com/sites/app-test`
- Production status: confirmed by human review as not production.
- Local read-only checks recorded in `docs/reports/support-case-app-test-read-only-diagnostics-2026-06-09.md`.
- SupportCase resources remain experimental.
- No app-test or production SharePoint resource has been created, modified, deleted, provisioned, bootstrapped, migrated, or granted permissions.

## Go Criteria

Proceed to the app-test diagnostics command only if all conditions are true:

- `main` and `origin/main` point to the same commit.
- `git status --short` is empty.
- The command target is exactly `https://isogokatudouhome.sharepoint.com/sites/app-test`.
- The target is not production.
- The SupportCase opt-in flag is explicit for the command only: `VITE_FEATURE_SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS=1`.
- The command is the read-only diagnostics command from the runbook.
- The operator confirms the command will not create lists, libraries, permissions, folders, files, or items.
- The operator is ready to stop if `support_case_*` appears without opt-in, `SupportCaseRestrictedDocuments` is not treated as a document library, or any new `FAIL` appears.

## No-Go Criteria

Stop without running diagnostics if any condition is true:

- The target URL is missing, ambiguous, or may be production.
- The command includes or implies `provision`, `bootstrap`, `create`, `ensure`, `setup`, `migrate`, `upload`, `permission`, or `delete`.
- The next step requires app-test resource creation.
- The next step requires production access.
- The next step requires SharePoint permission changes.
- The next step requires UI integration, migration, Graph API changes, `spFetch` changes, or `SupportCaseRepository` behavior changes.
- `.env`, token, secret, scratch, `.vscode/settings.json`, or `nvidia-nim-probe/` changes appear in the working tree.

## Planned Read-Only Command

Default diagnostics check:

```bash
SHAREPOINT_SITE=https://isogokatudouhome.sharepoint.com/sites/app-test \
npm run ci:integration:diagnose
```

Expected default behavior:

- `support_case_*` is not included.
- SupportCase diagnostics are skipped or absent without explicit opt-in.
- No SharePoint resource is created or changed.

Opt-in diagnostics check:

```bash
SHAREPOINT_SITE=https://isogokatudouhome.sharepoint.com/sites/app-test \
VITE_FEATURE_SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS=1 \
npm run ci:integration:diagnose
```

Expected opt-in behavior:

- `support_cases`, `support_case_documents`, `support_case_events`, and `support_case_restricted_documents` are diagnostics targets.
- `SupportCaseRestrictedDocuments` is treated as a document library.
- Restricted personal document storage remains separate from the standard `SupportCaseDocuments` metadata list.
- Missing app-test resources are reported as diagnostics only.
- No list, library, field, permission, folder, file, or item is created.

## Result Recording Requirements

Record the result in a separate docs-only report before considering any app-test creation planning:

- Target URL.
- Confirmation that production was not targeted.
- Exact command run.
- Whether opt-in was absent or present.
- Whether `support_case_*` appeared only with opt-in.
- Whether `SupportCaseRestrictedDocuments` was treated as a document library.
- New `FAIL` count.
- Existing unrelated warnings, if any.
- Confirmation that no SharePoint resource or permission was created, changed, or deleted.
- Stop condition result.
- Next recommended action.

## Still Out Of Scope

- App-test list or library creation.
- Production SharePoint changes.
- Permission provisioning.
- UI integration.
- Existing folder or document migration.
- Graph API or `spFetch` communication changes.
- `SupportCaseRepository` changes.
- File upload.
- Provisioning, bootstrap, setup, migration, create, ensure, or delete commands.
