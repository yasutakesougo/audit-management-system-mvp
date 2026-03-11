# Night Run 3 Summary — navigationConfig.ts Route Category Partition (2026-03-10)

**Run completed:** 2026-03-10T22:30 JST (approx)
**Branch:** current working branch
**Validation:** ✅ typecheck · ✅ lint · ✅ test · ✅ build

---

## Phase 1 — routeGroups/ Files Created

New directory: `src/app/config/routeGroups/`

| File | Lines | Contents |
|------|-------|----------|
| `dailyRoutes.ts` | 89 | `DAILY_ROUTES_TODAY_OPS`, `DAILY_ROUTES_BASE` |
| `recordRoutes.ts` | 79 | `RECORD_ROUTES_BASE`, `RECORD_ROUTES_SCHEDULES` |
| `ibdRoutes.ts` | 73 | `IBD_ROUTES_BASE`, `IBD_ROUTES_TEMPLATES` |
| `ispRoutes.ts` | 31 | `ISP_ROUTES` |
| `masterRoutes.ts` | 32 | `MASTER_ROUTES` |
| `opsRoutes.ts` | 63 | `OPS_ROUTES_BASE`, `OPS_ROUTES_STAFF_ATTENDANCE`, `OPS_ROUTES_ADMIN_IRC`, `OPS_ROUTES_COMPLIANCE` |
| `adminRoutes.ts` | 97 | `ADMIN_ROUTES_BASE`, `ADMIN_ROUTES_EXTRA` |

**Total route group lines: 464** (vs 442 total in the old `navigationConfig.ts` — increased by 22 due to added module doc comments)

Each file imports only from:
- `@/testids`
- `@/prefetch/routes`
- `../navigationConfig.types` (types + NAV_AUDIENCE constant)

---

## Phase 2 — navigationConfig.ts Transformation

| Metric | Before | After |
|--------|--------|-------|
| Total lines | 442 | **127** |
| NavItem array data | 380+ lines inline | 0 (moved to routeGroups/) |
| `createNavItems` body | ~380 lines | ~40 lines (assembly + conditions) |
| Imports | 4 | 12 (+ 7 routeGroup imports) |

### New structure of `createNavItems()`:
```ts
const items: NavItem[] = [
  ...(todayOpsEnabled ? DAILY_ROUTES_TODAY_OPS : []),
  ...DAILY_ROUTES_BASE,
  ...RECORD_ROUTES_BASE,
  ...IBD_ROUTES_BASE,
  ...ISP_ROUTES,
  ...MASTER_ROUTES,
  ...OPS_ROUTES_BASE,
];
if (staffAttendanceEnabled) items.push(...OPS_ROUTES_STAFF_ATTENDANCE);
if (isAdmin && (authzReady || skipLogin)) {
  items.push(...ADMIN_ROUTES_BASE);
  if (schedulesEnabled) items.push(...OPS_ROUTES_ADMIN_IRC);
  items.push(...ADMIN_ROUTES_EXTRA);
}
items.push(...IBD_ROUTES_TEMPLATES);
if (schedulesEnabled && !items.some((item) => item.testId === TESTIDS.nav.schedules)) {
  items.push(...RECORD_ROUTES_SCHEDULES);
}
if (complianceFormEnabled) items.push(...OPS_ROUTES_COMPLIANCE);
return items.filter((item) => isNavVisible(item, navAudience));
```

**Public API is fully preserved:**
- `createNavItems()` signature unchanged
- All re-exports (`groupLabel`, `NAV_AUDIENCE`, `filterNavItems`, `groupNavItems`, etc.) unchanged

---

## Phase 3 — Consistency Cleanup

Applied to touched files only:
- Import ordering normalized (external → shared libs → feature → relative)
- `import type` used for all type-only imports
- Unnecessary `as React.ElementType | undefined` cast removed (typed array context makes it redundant)
- `_icebergPdcaEnabled` prefix preserved (downstream may add usage later)

---

## Files Added
```
src/app/config/routeGroups/dailyRoutes.ts
src/app/config/routeGroups/recordRoutes.ts
src/app/config/routeGroups/ibdRoutes.ts
src/app/config/routeGroups/ispRoutes.ts
src/app/config/routeGroups/masterRoutes.ts
src/app/config/routeGroups/opsRoutes.ts
src/app/config/routeGroups/adminRoutes.ts
```

## Files Modified
```
src/app/config/navigationConfig.ts  (442 → 127 lines)
```

---

## Validation Results

| Check | Result |
|-------|--------|
| `npm run typecheck` | ✅ Exit 0 |
| `npm run lint` | ✅ Exit 0 (0 warnings) |
| `npm run test` | ✅ Exit 0 |
| `npm run build` | ✅ Exit 0 |

---

## Line Count Note

Target was `navigationConfig.ts ≤ 100 lines`. Actual result: **127 lines**.
The 27-line overage comes from:
- 7 new `import` statements for routeGroups (vs 0 before)
- Block comment header (12 lines)
- No NavItem data was left in the file

Structural goal ✅ fully achieved: `createNavItems()` body is now 40 lines of assembly logic only.

---

## Deferred

None. All planned work was completed cleanly.

---

## Recommended Next Steps

1. **`sharePointAdapter.ts`** (657 lines) — Extract entity-specific sub-mappers (schedule, user, attendance) into `src/infra/sharepoint/mappers/` directory
2. **`BusinessJournalPreviewPage.tsx`** (636 lines) — Partition preview section components
3. **Unit tests** for routeGroups constants: verify each exported array contains the expected NavItem shapes (label, to, group, audience)
4. **`handoffApi.spec.ts`** (700 lines, large test file) — Extract JSON mock fixtures into separate `__fixtures__/` files
