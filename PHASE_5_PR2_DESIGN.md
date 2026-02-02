# Phase 5-PR2: Theme Integration Design

**Base**: `e5107f5` (main with PR #319 merged)  
**Status**: Design-only (no code changes yet)  
**Goal**: Integrate `createAppTheme` into App's ThemeProvider with centralized density application

---

## ✅ What We Have (After PR #319 + #321)

### From PR #319 (Merged to main)
- `src/app/theme.tsx`:
  - `densitySpacingMap` exported
  - `applyDensityToDocument()` exported
  - `type Density` exported
- `src/features/settings/SettingsContext.tsx`: useSettingsContext available
- `src/App.tsx`: SettingsProvider wrapping entire app

### From PR #321 (Pending merge)
- `src/app/createAppTheme.ts`: Pure function to create MUI theme from UserSettings
- `src/app/__tests__/createAppTheme.spec.ts`: 10 unit tests

---

## 🎯 Phase 5-PR2 Goals

### 1. Centralize Density Application
**Problem**: Currently `applyDensityToDocument()` is called in `SettingsDialog.onChange`  
**Solution**: Move to a single hook/effect that runs on settings change

### 2. Integrate createAppTheme into ThemeProvider
**Problem**: App uses default MUI theme  
**Solution**: Replace with `createAppTheme(settings)`

### 3. Remove Side Effects from SettingsDialog
**Problem**: `handleDensityChange` calls `applyDensityToDocument` directly  
**Solution**: `onChange` only calls `updateSettings()`, effect happens elsewhere

---

## 📐 Proposed Architecture

```
┌─────────────────────────────────────────────┐
│ App.tsx                                     │
│  ├─ SettingsProvider (existing)            │
│  ├─ ThemeProvider (existing, to be updated)│
│  │   └─ theme = useAppTheme()             │ ← NEW
│  └─ RouterProvider                          │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ useAppTheme (NEW hook)                      │
│  ├─ const { settings } = useSettingsContext()│
│  ├─ const theme = useMemo(                  │
│  │     () => createAppTheme(settings),      │
│  │     [settings.density, ...]              │
│  │   )                                       │
│  └─ useEffect(() => {                        │
│       applyDensityToDocument(settings.density)│
│     }, [settings.density])                   │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ SettingsDialog (cleanup)                    │
│  └─ onChange={(d) => updateSettings({density:d})}│ ← Simplified
└─────────────────────────────────────────────┘
```

---

## 📝 Implementation Steps

### Step 1: Create `useAppTheme` Hook

**File**: `src/features/settings/hooks/useAppTheme.ts` (NEW)

```typescript
import { useEffect, useMemo } from 'react';
import { createAppTheme } from '@/app/createAppTheme';
import { applyDensityToDocument } from '@/app/theme';
import { useSettingsContext } from '../SettingsContext';

/**
 * Custom hook to create MUI theme from user settings
 * and apply density CSS variables
 */
export function useAppTheme() {
  const { settings } = useSettingsContext();

  // Create theme with density-aware spacing
  const theme = useMemo(
    () => createAppTheme(settings),
    [
      settings.density,
      settings.fontSize,
      settings.colorPreset,
      // Add more as needed
    ]
  );

  // Apply density CSS variables on density change
  useEffect(() => {
    applyDensityToDocument(settings.density);
  }, [settings.density]);

  return theme;
}
```

**Why this approach**:
- ✅ Centralized: One place for density application
- ✅ Automatic: Runs on every settings.density change
- ✅ Testable: Can spy on `applyDensityToDocument` calls
- ✅ Memoized: Theme recreation only when dependencies change

---

### Step 2: Update `App.tsx` to Use `useAppTheme`

**File**: `src/App.tsx` (MODIFIED)

**Before** (current):
```typescript
<ColorModeContext.Provider value={ctx}>
  <MUIThemeProvider theme={theme}>
    <CssBaseline />
    <RouterProvider router={router} />
  </MUIThemeProvider>
</ColorModeContext.Provider>
```

**After**:
```typescript
const appTheme = useAppTheme(); // NEW

<ColorModeContext.Provider value={ctx}>
  <MUIThemeProvider theme={appTheme}> {/* Changed */}
    <CssBaseline />
    <RouterProvider router={router} />
  </MUIThemeProvider>
</ColorModeContext.Provider>
```

**Conflict Risk**: Low - ThemeRoot is separate from Phase 4 changes

---

### Step 3: Simplify `SettingsDialog`

**File**: `src/features/settings/SettingsDialog.tsx` (MODIFIED)

**Remove**:
```typescript
import { applyDensityToDocument } from '@/app/theme'; // DELETE

const handleDensityChange = useCallback((newDensity: Density) => {
  updateSettings({ density: newDensity });
  applyDensityToDocument(newDensity); // DELETE THIS LINE
}, [updateSettings]);
```

**After**:
```typescript
const handleDensityChange = useCallback((newDensity: Density) => {
  updateSettings({ density: newDensity }); // Only this
}, [updateSettings]);
```

**Why**: `useAppTheme` will automatically apply density via useEffect

---

### Step 4: Update `createAppTheme.ts` to Import from theme.tsx

**File**: `src/app/createAppTheme.ts` (MODIFIED)

**Before** (current):
```typescript
const densitySpacingMap = {
  compact: 4,
  comfortable: 8,
  spacious: 12,
} as const; // Local definition
```

**After**:
```typescript
import { densitySpacingMap } from './theme'; // Import from theme.tsx
```

**Why**: PR #319 already exports `densitySpacingMap` from theme.tsx

---

### Step 5: Add Tests for `useAppTheme`

**File**: `src/features/settings/hooks/__tests__/useAppTheme.spec.ts` (NEW)

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppTheme } from '../useAppTheme';
import * as theme from '@/app/theme';

vi.mock('@/features/settings/SettingsContext', () => ({
  useSettingsContext: () => ({
    settings: {
      density: 'comfortable',
      colorMode: 'light',
      fontSize: 'medium',
      colorPreset: 'default',
      lastModified: Date.now(),
    },
    updateSettings: vi.fn(),
  }),
}));

describe('useAppTheme', () => {
  it('calls applyDensityToDocument on mount', () => {
    const spy = vi.spyOn(theme, 'applyDensityToDocument');
    
    renderHook(() => useAppTheme());
    
    expect(spy).toHaveBeenCalledWith('comfortable');
  });

  it('creates theme with density spacing', () => {
    const { result } = renderHook(() => useAppTheme());
    
    expect(result.current.spacing(1)).toBe('8px'); // comfortable = 8px
  });
});
```

---

## 🧪 Testing Strategy

### Unit Tests (New)
1. `useAppTheme.spec.ts`: Hook behavior
   - ✅ Calls `applyDensityToDocument` on mount
   - ✅ Creates theme with correct spacing
   - ✅ Re-applies density on settings.density change

### Integration Tests (Update existing)
2. `integration.spec.tsx`: Update to verify hook integration
   - ✅ Density change via SettingsDialog triggers theme update
   - ✅ CSS variables applied correctly

### Snapshot Tests (Update if needed)
3. Update snapshots if ThemeProvider changes UI

---

## 🚨 Conflict Risk Assessment

| File | Change Type | Conflict Risk | Mitigation |
|------|-------------|---------------|------------|
| `src/app/createAppTheme.ts` | Import change | ✅ **None** | PR #319 already in main |
| `src/features/settings/hooks/useAppTheme.ts` | NEW file | ✅ **None** | New file |
| `src/App.tsx` | ThemeRoot modification | 🟡 **Low** | Check PR #320 changes |
| `src/features/settings/SettingsDialog.tsx` | Remove side effect | 🟡 **Low** | PR #320 added it, we remove it |

---

## ⚠️ Known Issues to Fix in PR2

### Issue 1: Fragile Tests in `createAppTheme.spec.ts`

**Problem**: Tests check exact string values like `theme.spacing(1).toBe('8px')`  
**Risk**: Breaks if MUI changes internal implementation  
**Fix**: Update tests to check:
- `typeof theme.spacing(1) === 'string'`
- `theme.spacing(1).includes('px')`
- Or verify `densitySpacingMap` values directly

**When**: During PR2 implementation (same commit as import fix)

---

## 📦 PR2 Commit Strategy

### Single Atomic Commit (Recommended)
```bash
git add src/features/settings/hooks/useAppTheme.ts
git add src/features/settings/hooks/__tests__/useAppTheme.spec.ts
git add src/app/createAppTheme.ts  # Import fix
git add src/app/__tests__/createAppTheme.spec.ts  # Test robustness fix
git add src/App.tsx
git add src/features/settings/SettingsDialog.tsx

git commit -m "feat(phase5): integrate createAppTheme with centralized density application

- Add useAppTheme hook (density application + theme creation)
- Integrate into App.tsx ThemeProvider
- Remove side effect from SettingsDialog (updateSettings only)
- Import densitySpacingMap from theme.tsx (PR #319 merged)
- Fix fragile tests in createAppTheme.spec.ts (px string checks)

Phase 5-PR2: Complete theme integration"
```

---

## 🎯 Success Criteria (DoD)

- [ ] `useAppTheme` hook created with tests
- [ ] `App.tsx` uses `useAppTheme` instead of default theme
- [ ] `SettingsDialog` calls only `updateSettings()` (no side effects)
- [ ] `createAppTheme` imports `densitySpacingMap` from `theme.tsx`
- [ ] Tests updated to be less fragile (no exact string matching)
- [ ] All existing tests pass (40/40 Settings tests)
- [ ] CI passes (lint, typecheck, vitest, e2e-smoke)
- [ ] No conflicts with PR #320/321

---

## 📊 Current PR Status (Baseline for PR2)

| PR | Status | Notes |
|----|--------|-------|
| #318 | ✅ MERGED | DensityControl component in main |
| #319 | ✅ MERGED | SettingsContext + CSS variables + density exports in main |
| #320 | ⚠️ OPEN | Needs rebase on main (e5107f5) |
| #321 | 🔄 OPEN | CI IN_PROGRESS, MERGEABLE, Auto-merge enabled |

**Next Action**: Wait for #321 to merge, then implement PR2 on top of updated main

---

## 🚀 Implementation Timeline

**Estimated Time**: 1-2 hours

1. **Setup** (5 min): Ensure #321 merged, update main
2. **useAppTheme** (20 min): Hook + tests
3. **App.tsx** (10 min): ThemeProvider integration
4. **SettingsDialog** (5 min): Remove side effect
5. **createAppTheme** (5 min): Import fix
6. **Test fixes** (15 min): Make tests less fragile
7. **Validation** (30 min): Full test suite + manual testing
8. **Commit & Push** (5 min): Single atomic commit

**Total**: ~1.5 hours

---

## 📌 Dependencies

- ✅ PR #319 merged (provides `densitySpacingMap`, `applyDensityToDocument`)
- 🔄 PR #321 pending (provides `createAppTheme`)
- ⚠️ PR #320 needs rebase (conflicts with main after #319 merge)

**Blocker**: PR #321 must merge before starting PR2 implementation

---

**Document Status**: Design complete, awaiting PR #321 merge to begin implementation
