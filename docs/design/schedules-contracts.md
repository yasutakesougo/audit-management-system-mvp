# Schedules Contracts (Day/Week/Month)

## 0. Purpose
Keep Day, Week, and Month aligned on the same filter and navigation contracts to prevent UI drift and E2E flakes.

## 1. Terms
- items: list returned by `useSchedules(range)` (normalized).
- filteredItems: `items` after applying filters (category, query, etc.).
- activeCategory: `User | Staff | Org` (Org is displayed as 施設).
- activeDateIso: `YYYY-MM-DD`.
- mode/tab: `day | week | month`.

## A. Items Unification (Display Contract)
### A1. Single Source of Truth
- Day/Week/Month must render from the same `filteredItems` pipeline.
- Month badge counts and popover lists must also be derived from `filteredItems`.

**A2: Month reflects filters (YES).**

**Expected effect**
- If the header filter is set to 施設, Month must not show all-category counts or lists.

## B. Tab Navigation (State Carry-over Contract)
### B1. Week -> Day lane carry-over
- Week lane (施設/利用者/職員) must carry into Day category filter.
- `lane=` in the URL is allowed as a one-time handoff; Day may clear it after applying.

### B2. Month -> Day carry-over
- Month -> Day must preserve the active filter (especially category).
- **activeCategory must be preserved on Month -> Day navigation.**

## C. Count vs List Consistency (UX Contract)
### C1. Month badge count == Popover list count
- Both are computed from the same `filteredItems` for that date.

**Note on multi-day events (Contract v1)**
- Current spec: count by start date.
- If this changes later, document as Contract v2 and lock with unit tests.

## 2. Test Lock (Minimal Set)
### E2E (required)
- Month -> Day keeps category (e.g., 施設).
- Expectation: Day category filter is 施設; create dialog default category is 施設.

### Unit (optional, light)
- Month day summary count/list consistency after multi-day spec is finalized.

## 3. D-3 Mapping (Minimal Changes)
Goal: Month must use the same `filteredItems` contract as Week/Day.

### Expected edits
1) `WeekPage.tsx`
- Expose `filteredItems` to Month (via props is the smallest diff).

2) `MonthPage.tsx`
- Stop calling `useSchedules(calendarRange)`.
- Use props `items` for `buildDaySummaries` and `getItemsForDate`.

3) Month -> Day navigation
- Carry `activeCategory` through navigation (e.g., `tab=day&lane=<activeCategory>`).

### E2E update
- Update the existing `schedule-month-to-day.smoke.spec.ts` to assert Month -> Day keeps category.

## 4. Decision
- A2 is **YES**: Month reflects active filters.
