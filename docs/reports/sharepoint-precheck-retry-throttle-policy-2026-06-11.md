# SharePoint Precheck Retry and Throttle Policy - 2026-06-11

## Scope

This report defines the retry and throttle policy for SharePoint prechecks before SupportCase app-test resource creation.

This is a docs-only policy record. It does not connect to SharePoint, rerun diagnostics, create lists or libraries, change permissions, update runtime code, connect UI, migrate documents, or change `SupportCaseRepository` behavior.

## Source Incident

The first approved `SupportCaseDocuments` creation attempt stopped during the required pre-creation metadata check:

| Resource | Precheck result | Creation result |
|---|---|---|
| `SupportCaseDocuments` | HTTP `429` | stopped before creation |

No request digest was requested, no list was created, and no fields were created.

Source record:

- `docs/reports/support-case-app-test-supportcase-documents-list-creation-attempt-2026-06-10.md`

## Decision

Treat HTTP `429` from a SharePoint precheck as "existence unknown".

Do not treat HTTP `429` as equivalent to HTTP `404`.

Do not create a SharePoint resource after a `429` precheck. Creation can proceed only after a later read-only precheck returns an accepted non-ambiguous result.

Accepted pre-creation states:

| Precheck result | Meaning | Creation allowed in same operation |
|---|---|---|
| HTTP `404` for the target resource | Target absent, if site and title are confirmed | yes, only if all other safety checks pass |
| HTTP `200` for the target resource | Target already exists | no; classify existing resource first |
| HTTP `403` for the target resource | Existence or access is ambiguous | no |
| HTTP `429` for the target resource | Throttled; existence unknown | no |
| HTTP `5xx` for the target resource | Service or transient failure | no |
| Network or auth failure | Environment ambiguous | no |

## Retry-After Handling

If SharePoint returns a `Retry-After` header:

- Record the header value in the result report.
- Wait at least the indicated duration before any read-only retry.
- Do not perform list creation in the same operation that received the `429`.
- Do not retry broader diagnostics while waiting.

If no `Retry-After` header is present:

- Treat the response as throttling with an unknown cooldown.
- Wait at least 15 minutes before a single read-only precheck retry.
- Do not make repeated requests to infer the cooldown.

## Retry Limits

Allowed retry pattern for a single resource precheck:

| Attempt | Allowed action |
|---|---|
| First attempt | Read-only metadata precheck only |
| Second attempt | One read-only retry after `Retry-After` or a 15-minute minimum wait |
| Third attempt | Stop and return to human review |

Do not run more than two read-only precheck attempts for the same resource in one work session.

Do not run prechecks for multiple SupportCase resources as a substitute for waiting out a throttle window.

## Backoff and Spacing

Minimum spacing:

- With `Retry-After`: wait at least the header duration.
- Without `Retry-After`: wait at least 15 minutes.
- After two 429 responses for the same resource: stop for the day unless a human explicitly approves a later read-only retry.

The next retry must still be read-only. It must not request a form digest or call create/provision/ensure endpoints unless the retry returns a safe absent-resource state and a separate creation step is still approved.

## Continuous Diagnostics Avoidance

Avoid repeated diagnostics or prechecks when any of the following is true:

- A target resource returned HTTP `429`.
- A prior read-only precheck was run recently for the same site and resource.
- Multiple SupportCase resources would be checked in a tight loop.
- The current operation would mix existence checks with creation, permission changes, UI work, repository wiring, or migration.

Prefer one narrowly scoped precheck for one resource at a time.

## Stop Conditions

Stop immediately if any condition occurs:

- HTTP `429` appears on any target-resource precheck.
- HTTP `403` appears where existence must be known before creation.
- The precheck response cannot distinguish absent from inaccessible.
- The target site is not the app-test site.
- The target resource is not the single approved resource.
- The next step would need permission changes.
- The next step would touch production.
- The script would create multiple resources in one operation.
- The script would proceed without recording the precheck result.

## Return to Administrator Review

Return to administrator review instead of retrying if:

- Two read-only prechecks return HTTP `429`.
- The `429` response persists across work sessions.
- SharePoint responses alternate between `403`, `429`, and other ambiguous states.
- The diagnostics identity may be throttled or blocked.
- The app-test site health or tenant throttling state is unknown.
- The resource may already exist but cannot be confirmed by the current identity.

Administrator review should confirm:

- The app-test site is healthy.
- The target resource does or does not exist.
- The diagnostics or creation identity is allowed to perform metadata readback.
- No tenant-level throttling or service issue is active.

## Conditions Before Creation After a 429

After any `429`, creation remains stopped until all conditions are true:

- A later read-only precheck returns HTTP `404` for the target resource.
- The target site is explicitly confirmed as app-test.
- Production is excluded.
- The approved resource is still the only creation target.
- No permission change is required.
- The prior `429` and retry result are recorded.
- The operator confirms the creation approval is still valid.

For `SupportCaseDocuments`, the approval wording remains:

```txt
app-test に SupportCaseDocuments list を作成してよい
```

If the retry occurs in a later session, restate the approval before creating.

## Out of Scope

- No SharePoint connection.
- No diagnostics rerun.
- No `SupportCaseDocuments` creation retry.
- No `SupportCaseEvents` creation.
- No `SupportCaseRestrictedDocuments` creation.
- No permission changes.
- No production changes.
- No UI integration.
- No migration.
- No Graph API or `spFetch` changes.
- No `SupportCaseRepository` changes.
- No `.env`, token, or secret changes.

## Next Step

Keep `SupportCaseDocuments` creation paused.

The next safe operation is a single read-only precheck retry after the throttle window has cleared and only if a human explicitly asks for that retry.
