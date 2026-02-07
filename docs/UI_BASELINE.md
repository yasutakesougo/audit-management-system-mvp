# UI Baseline (Phase 1)

This project enforces a UI baseline optimized for:
- **13-inch laptops** (1366×768 primary target)
- **11–12 inch tablets** (touch-first interaction)

## Design Rules

### Typography
- Base font: **16px** / line-height **1.7**
- Headings: h1 (1.75rem), h2 (1.375rem), h3 (1.125rem)
- Max text width: **72–80ch** (optimal readability)

### Touch Targets
- Minimum: **48×48px** (WCAG AAA compliance)
- FAB (Floating Action Button): **64×64px** (tablet thumb zone)
- Applies to: buttons, tabs, list items, menu items, form inputs

### Scroll Ownership
- **Page-level scroll** is the default
- No nested scroll containers (except intentional data tables)
- Sticky headers remain at viewport top during scroll

### Responsive Spacing

#### Breakpoints
- `xs` (<600px): Compact mobile layout
- `sm` (600–1199px): Tablet-optimized spacing
- `md` (≥1200px): Desktop breathing space

#### Spacing Tokens
```tsx
Stack spacing={{ xs: 2, sm: 3, md: 4 }}   // Section spacing
Paper padding={{ xs: 2, sm: 3 }}            // Card padding
Container py: { xs: 2, sm: 3, md: 4 }       // Page padding
```

## Implementation

### Theme Configuration
Location: `src/app/theme.tsx`

```tsx
typography: {
  fontSize: 16,
  body1: { lineHeight: 1.7 },
  body2: { lineHeight: 1.7 },
  // ...
}

components: {
  MuiButton: { styleOverrides: { root: { minHeight: 48 } } },
  MuiTab: { styleOverrides: { root: { minHeight: 48 } } },
  MuiListItemButton: { styleOverrides: { root: { minHeight: 48 } } },
  // ...
}
```

### Applied Pages
- [DashboardPage.tsx](../src/pages/DashboardPage.tsx): Main dashboard grid
- [WeekPage.tsx](../src/features/schedules/WeekPage.tsx): Schedule view with 64px FAB
- [UsersPanel.tsx](../src/features/users/UsersPanel.tsx): User management table
- [SupportRecordPage.tsx](../src/pages/SupportRecordPage.tsx): Long-form input

## Regression Protection

UI baseline is protected by **Playwright E2E tests**:

### Test Suite: `tests/e2e/ui/`
1. **touch-targets.spec.ts**
   - Verifies 48px minimum for all interactive elements
   - Validates FAB 64×64px on tablet-optimized screens

2. **responsive-layout.spec.ts**
   - Tests 4 breakpoints (375/768/1024/1366px)
   - Ensures no horizontal scroll at each viewport

3. **scroll-behavior.spec.ts**
   - Validates natural page-level scrolling
   - Detects unintended internal scroll containers
   - Allows intentional table scroll (UsersPanel)

### CI Integration
```yaml
# .github/workflows/smoke.yml
e2e-ui-regression:
  runs-on: ubuntu-latest
  steps:
    - run: npx playwright test tests/e2e/ui --project=chromium
```

## Recent Changes

- **2026-02-01**: Dashboard spacing compacted (PR #289) — responsive padding only, no behavior change.

**Current Status**: 12 passed, 6 skipped (11.8s)

## Future Phases

### Phase 2 (COMPLETED - Feb 2, 2026)

**PR #315: Settings Panel Entry Point (MERGED)**

- **Settings Dialog UI** (`src/features/settings/SettingsDialog.tsx`)
  - Dark mode toggle using ColorModeContext
  - Entry point for future density/font size settings
  - Material UI Dialog with proper accessibility (aria labels, focus management)
  - Placeholders for Phase 2+ features

- **AppShell Integration** (`src/app/AppShell.tsx`)
  - Settings button added to AppBar (icon: SettingsRoundedIcon)
  - `settingsDialogOpen` state management
  - Positioned before Brightness toggle for logical grouping

- **UI Baseline** 
  - Dark mode palette ready for activation (ColorModeContext exists)
  - Density toggle structure prepared (UI skeleton)
  - Display settings dialog confirms responsive MUI integration

**CI Validation**: All 20+ checks PASS (vitest, typecheck, e2e-smoke, schedule-guardrails, quality, preflight matrix)

**Next**: Phase 2 feature expansion (density control, font size, color customization)

### Phase 3+ (Backlog)
- High contrast mode
- Print stylesheet optimization
- Reduced motion support

## References

- [WCAG 2.1 Touch Target Guidelines](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html)
- [Material Design Touch Targets](https://material.io/design/usability/accessibility.html#layout-and-typography)
- [Responsive Breakpoints](https://mui.com/material-ui/customization/breakpoints/)
