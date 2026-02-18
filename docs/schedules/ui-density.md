# Schedule UI Density & Touch Target Optimization

## Overview

Multi-phase optimization of schedule views for both **information density** (desktop/tablet) and **touch safety** (mobile) using device-aware responsive design and unified spacing tokens.

## Phases Completed

### Phase 1: Header Touch Targets & WeekView Density (PR #495)

**Goal:** Responsive button sizing + lane compression

**Changes:**
- Header buttons: Pointer-aware sizing via `@media (pointer: coarse)`
  - Desktop/tablet (fine pointer): `minHeight 36px` → Maintains 1-row header density
  - Mobile (coarse pointer): `minHeight 44px + minWidth 44px` → Prevents mis-taps (誤タップ防止)
- WeekView lane compression:
  - Min-width: 280px → 260px
  - Gap: 16px → 12px
  - Card padding: 12px → 8px

**Token:** `SCHEDULE_UI_DENSITY` (src/features/schedules/constants.ts)
```typescript
export const SCHEDULE_UI_DENSITY = {
  card: {
    contentClassName: 'flex w-full flex-col gap-1 px-2 py-1.5 text-left sm:gap-1.5 sm:px-3 sm:py-2',
    chipRowClassName: 'mt-0.5 flex flex-wrap items-center gap-1',
  },
  lane: {
    gridGap: 12,
    gridAutoColumnsDesktop: 'minmax(260px, 1fr)',
    gridAutoColumnsMobile: 'minmax(240px, 1fr)',
    padding: 8,
    minWidthDesktop: 260,
    minWidthMobile: 240,
    headerMarginBottom: 8,
  },
} as const;
```

**Status:** ✅ MERGED (PR #495)

---

### Phase 2: DayView Timeline Spacing (PR #496)

**Goal:** Token-based spacing for timeline-style schedule cards

**Changes:**
- Separated timeline-specific tokens from card-based tokens
- Replaced inline `isCompact` ternaries with centralized token references
- Maintained responsive behavior (compact/normal variants)

**Token:** `SCHEDULE_TIMELINE_SPACING` (src/features/schedules/constants.ts)
```typescript
export const SCHEDULE_TIMELINE_SPACING = {
  itemPaddingCompact: '4px 8px',
  itemPaddingNormal: '6px 10px',
  itemGapCompact: 4,
  itemGapNormal: 8,
  itemGridGapCompact: 8,
  itemGridGapNormal: 12,
  headerGapCompact: 6,
  headerGapNormal: 8,
  railWidth: 2,
  dotSize: 10,
} as const;
```

**Status:** 🔄 Auto-merge enabled (PR #496)

---

## Design Principles

### 1. Separate Tokens by Layout Type

- **Card-based** (Week): Tailwind className compression (SCHEDULE_UI_DENSITY)
- **Timeline-based** (Day): Inline style + compact/normal variants (SCHEDULE_TIMELINE_SPACING)
- **Grid-based** (Month): CSS Grid parameters + cell sizing (SCHEDULE_MONTH_SPACING - planned)

**Rationale:** Different layout paradigms need independent token structures. Mixing them creates future friction when adjusting a single view independently.

### 2. Pointer-Aware Responsive Design

Use CSS `@media (pointer: coarse)` instead of breakpoint-only queries for device-aware touch targets.

```css
@media (pointer: coarse) {
  /* Mobile/touch devices */
  minHeight: 44px;
  minWidth: 44px;
}
```

### 3. Compact/Normal Variants

All tokens include compact/normal pairs for consistent density across form factors:
- Compact: Optimized for information density (mobile, space-constrained)
- Normal: Comfortable spacing for touch + readability

---

## Implementation Guidelines

### When Modifying Density

1. Update the **token value** in constants.ts (single source of truth)
2. No inline `isCompact ? X : Y` patterns—always use token references
3. Run full test suite: `npm run typecheck && npm run test:e2e:smoke`
4. Verify visual consistency across all views in the same category

### Adding New Views to Density Optimization

1. Analyze layout type: Card → use SCHEDULE_UI_DENSITY; Timeline → SCHEDULE_TIMELINE_SPACING; Grid → create SCHEDULE_MONTH_SPACING
2. Identify all responsive values (padding, gap, minHeight, etc.)
3. Extract compact/normal pairs to new token
4. Replace inline styles with token references
5. Ensure pointer-aware touch targets where applicable

---

## Next Steps

### Phase 3: MonthPage Grid Density (Planned)

**Target:** Consistent month view density with token-based cell sizing

**Identified values to token:**
- Grid gap: 6 (compact) / 8 (normal)
- Cell padding: `6px 8px` (compact) / `10px 12px` (normal)
- Cell minHeight: 64 (compact) / 90 (normal)
- Cell gap: 0 (compact) / 1 (normal)
- Header padding: `12px 8px 24px` (compact) / `16px 12px 32px` (normal)

**Token structure:** `SCHEDULE_MONTH_SPACING` (separate block, not mixed with card/timeline)

---

## Testing Strategy

All density changes must pass:
1. **typecheck:** Verify token types are correct
2. **smoke E2E:** Ensure no regressions in layout/spacing
3. **visual inspection:** Confirm responsive behavior on actual devices (optional but recommended)

---

## Monitoring & Adjustment

Post-implementation, monitor for:
- Week ↔ Day switching: Expected density to be **consistent, not identical** (different layouts)
- Mobile touch accuracy: Verify `@media (pointer: coarse)` buttons are not mis-tapped
- Information visibility: Confirm tighter spacing doesn't hide essential content

If density feels "off", adjust the token (e.g., gridGap: 12 → 10) and re-validate with tests.
