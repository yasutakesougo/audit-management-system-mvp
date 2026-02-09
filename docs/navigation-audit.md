# Navigation Audit (Side Menu / Footer Quick Actions)

> Purpose: Prevent “URL-only” access and reduce staff getting lost by ensuring implemented routes are exposed appropriately via Side Menu and Footer Quick Actions.

## Context
This repository is a React + SharePoint SPA for welfare operations, with multiple feature areas (daily records, attendance, schedules, analysis, admin tools, nurse).

## Sources of Truth (audited)
- src/app/router.tsx (RouteObject definitions / redirects)
- src/app/AppShell.tsx (Side menu + Footer Quick Actions exposure)
- src/features/nurse/routes/NurseRoutes.tsx (Nurse feature routes)
- Unit tests
  - tests/unit/AppShell.nav.spec.tsx
  - tests/unit/__snapshots__/ui.snapshot.spec.tsx.snap

## Audit Method
1. Enumerate implemented routes from router.tsx (and feature route modules).
2. Enumerate navigation entries from AppShell.tsx:
   - Side Menu entries (global navigation)
   - Footer Quick Actions entries (short-distance “field staff” navigation)
3. Compare and classify each route:
   - Implemented vs Partially gated (Feature Flag / Gate)
   - Exposed via Side / Footer / Context-only / URL-only
4. Decide exposure level by role + operational frequency + risk:
   - Side Menu: discoverable entry points
   - Footer: frequent daily use (keep ≤ 4)
   - Context-only: only reachable from within a feature flow
   - Hidden: dev-only or edit-only (misoperation risk)

## Route Exposure Classification
### Legend
- ✅ Implemented
- 🟡 Partial / behind Feature Flag / Gate
- ❌ Not implemented (design only)

### A. Must-have Side Menu Entries (added in PR #412)
These were implemented but previously URL-only / unclear entry points.

- /records — Black Note list
- /records/monthly — Monthly records
- /handoff-timeline — Handoff timeline
- /meeting-guide — Meeting facilitator guide
- /admin/step-templates — Admin: step templates
- /admin/individual-support — Admin: individual support procedures
- /admin/staff-attendance — Admin: staff attendance management

Why: URL-only entry points are operationally fragile (knowledge silo, training cost, “can’t find it” incidents).
Placement rule: Admin routes must be grouped under “Admin” section to reduce misoperation.

## Footer Quick Actions Policy
### Goal
Short-distance navigation for field staff, optimized for tablets/mobile.

### Rules
- Max 4 actions
- Pick high-frequency daily tasks
- Prefer safe operations (avoid edit-only/admin-only)
- Keep labels consistent with on-site workflows

### Current + Candidate
- ✅ /daily/table — Daily records (table)
- ✅ /daily/attendance — Attendance
- ✅ /daily/support — Support procedure record
- ✅ /daily/health — Health record

Candidate (if needed):
- /handoff-timeline — Consider swapping with /daily/health if handoff is more frequent for your site
- /nurse/observation — Consider adding for nurse-heavy operations (may swap with one existing item)

## Context-only Routes (do NOT expose globally unless proven necessary)
These routes may be intended to be reached from within a parent feature page.
Do not add to Side/Footer unless we confirm “no parent navigation exists”.

- /daily/activity
- /daily/support-checklist
- /schedules/day (🟡)
- /schedules/month (🟡)

Follow-up check: Confirm each has a reliable parent-link (menu page / tabs / in-feature navigation).

## Intentionally Hidden Routes (keep hidden)
These routes increase the risk of confusion or misoperation if exposed globally.

- /dev/schedule-create-dialog — Dev-only
- /analysis/iceberg-pdca/edit — Edit-only (avoid accidental access)

Policy: Hidden routes may remain accessible by direct URL for dev/admin use, but should not be discoverable in global navigation.

## Feature Flags / Gates Notes
Routes behind feature flags must have explicit visibility conditions in navigation:
- show entry only when enabled
- otherwise omit (not disabled-looking items)

Examples:
- /analysis/iceberg-pdca (🟡) — Side menu only when feature flag is ON
- /staff/attendance (🟡) — Side menu only when feature flag is ON
- /schedules/week (🟡) — Side menu only when feature flag + gate satisfied

## Changes Implemented
### PR #412
- Added the 7 must-have routes to Side Menu
- Updated nav unit test assertions
- Updated snapshots (removed obsolete snapshot content and regenerated via -u)

### Follow-up (Post-PR #412)
- Added a daily menu link to /daily/time-based to ensure non-URL-only access

### PR #411 (Draft)
- Parked due to broad CI failures (layout/theme) not related to navigation exposure
- Revisit by splitting into smaller PRs (layout-only vs theme-only)

## Definition of Done (Navigation)
- [ ] All “Must-have Side Menu Entries” are present and grouped correctly
- [ ] Footer Quick Actions ≤ 4 and aligned with daily workflows
- [ ] Hidden routes remain hidden and documented
- [ ] Context-only routes have confirmed parent navigation
- [ ] Tests are updated (AppShell.nav.spec.tsx + snapshots) and CI green

## Follow-ups (Next Tasks)
1. Verify parent navigation for context-only routes:
   - Where does /daily/activity get linked from?
   - Where does /daily/time-based get linked from?
   - Is /daily/support-checklist reachable from daily menu?
2. Decide Footer Quick Actions final set (site policy):
   - Keep /daily/health or swap with /handoff-timeline or /nurse/observation
3. Split PR #411:
   - PR-A: AppShell layout stabilization only
   - PR-B: Eye-friendly theme change only (snapshot/a11y adjustments included)

## Appendix: Useful Commands
# List implemented routes
rg "path:|Navigate|RouteObject" src/app/router.tsx

# Find nav definitions
rg "nav|menu|QuickActions|Footer" src/app/AppShell.tsx

# Validate required checks
gh pr checks <PR_NUMBER> --required

# Regenerate snapshots when UI changes are intentional
npm test -- -u
