# SupportCase App-Test Read-Only Diagnostics Result - 2026-06-09

## Scope

This report records the read-only diagnostics checks run before any app-test SupportCase SharePoint resource creation.

No SharePoint list, library, permission, folder, file, item, migration, UI integration, Graph API change, `spFetch` change, or `SupportCaseRepository` change was made.

## Target Confirmation

- App-test URL: `https://isogokatudouhome.sharepoint.com/sites/app-test`
- Production status: confirmed by human review as not production.
- Opt-in flag for SupportCase diagnostics: `VITE_FEATURE_SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS=1`
- The opt-in flag was passed only inline for the command that needed it. No `.env` file was changed.

## Commands Run

```bash
git status --short
git branch --show-current
git pull --ff-only
npm run sp:audit
VITE_FEATURE_SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS=1 npm run sp:audit
npx vitest run src/sharepoint/__tests__/supportCaseDiagnosticsPreflight.spec.ts
npx vitest run src/sharepoint/__tests__/driftProbeRegistry.spec.ts src/sharepoint/fields/__tests__/supportCaseFields.spec.ts
```

## Default Diagnostics Result

Command:

```bash
npm run sp:audit
```

Result:

- Passed.
- `ListKeys (42) === LIST_CONFIG entries (42)`.
- All 24 manifest entries exist in `ListKeys`.
- Existing warnings remained limited to:
  - `AbcBehaviorRecords`
  - `List2`
  - `ToiletRecords`
- No new `FAIL` was reported.
- `support_case_*` resources were not reported as default diagnostics or default drift probe targets.

## Opt-In Diagnostics Result

Command:

```bash
VITE_FEATURE_SUPPORT_CASE_SHAREPOINT_DIAGNOSTICS=1 npm run sp:audit
```

Result:

- Passed.
- `ListKeys (42) === LIST_CONFIG entries (42)`.
- All 24 manifest entries exist in `ListKeys`.
- Existing warnings remained limited to:
  - `AbcBehaviorRecords`
  - `List2`
  - `ToiletRecords`
- No new `FAIL` was reported.
- No persistent environment file was changed.

## SupportCase Boundary Checks

Command:

```bash
npx vitest run src/sharepoint/__tests__/supportCaseDiagnosticsPreflight.spec.ts
```

Result:

- Passed: 1 test file, 9 tests.
- Production URL detection, app-test target validation, explicit opt-in, default exclusion, opt-in target inclusion, experimental lifecycle, and restricted document library boundaries remained covered.

Command:

```bash
npx vitest run src/sharepoint/__tests__/driftProbeRegistry.spec.ts src/sharepoint/fields/__tests__/supportCaseFields.spec.ts
```

Result:

- Passed: 2 test files, 19 tests.
- `support_case_*` default exclusion and opt-in target selection remained covered.
- `SupportCaseRestrictedDocuments` remained treated as a document library.
- Restricted document storage remained separate from the standard `SupportCaseDocuments` metadata list.
- SupportCase resources remained `experimental`.

## Safety Result

- App-test URL was confirmed before recording diagnostics results.
- Production was not targeted.
- `support_case_*` did not appear without explicit opt-in.
- Opt-in behavior remains covered by local boundary tests.
- No new `sp:audit` failure appeared.
- No SharePoint resource was created, modified, deleted, provisioned, bootstrapped, migrated, or granted permissions.

## Next Action

Proceed only to a separate reviewed step for app-test diagnostics execution planning. Do not create app-test lists or libraries, change permissions, connect UI, migrate documents, add Graph API or `spFetch` communication, or change `SupportCaseRepository` behavior as part of this result-recording step.
