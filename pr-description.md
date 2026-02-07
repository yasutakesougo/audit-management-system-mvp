# PR: Add Recent Navigation with localStorage Persistence

## ✅ Review Checklist (before merge)

**CAUTION: Must check before merging to protect main branch**

- [ ] Code changes reviewed and aligned with project standards
- [ ] All E2E tests passed (including nav-and-status.smoke.spec.ts)
- [ ] Typecheck and lint passed
- [ ] Manual testing completed (Recent section appears, deduplication, max 5 items, search hiding, mini mode, persistence)
- [ ] PR title follows conventional commit format
- [ ] Related issues/tasks updated (if any)

---

## 🌟 Overview (TL;DR)

Adds a "Recent" navigation section to track the last 5 accessed navigation items with localStorage persistence. Provides quick access to frequently used pages.

## 📝 Changes Summary

### 1. **Recent Navigation Logic** ([src/app/AppShell.tsx](src/app/AppShell.tsx))

- **localStorage Utilities**:
  - `loadRecentKeys()`: Loads recent keys from localStorage with error-safe JSON parsing
  - `saveRecentKeys()`: Saves recent keys with error-safe stringification
  - `RECENT_NAV_STORAGE_KEY = 'iceberg-recent-nav'`

- **Type Definition**:
  ```typescript
  type RecentNavKey = { testId?: string; to: string };
  ```
  - Uses `testId` as primary key for resolution (stable across nav changes)
  - Falls back to `to` for items without testId

- **State & Effects**:
  - `recentKeys` state loaded from localStorage on mount
  - `addRecent()` callback: Adds item to front, deduplicates, caps at 5 items
  - `recentItems` memoized resolver: Maps keys to actual `NavItem` objects from `filteredNavItems`

- **Integration**:
  - `renderNavItem()`: Calls `addRecent()` on every navigation (click or Enter key)
  - Display-time resolution respects admin/feature flag filtering automatically

### 2. **UI Display** (Desktop & Mobile)

- **Conditional Rendering**:
  - Shows when `navQuery === ''` (search is empty) AND `recentItems.length > 0`
  - Hidden during search to avoid cluttering results

- **Layout**:
  - Positioned after search/toggle, before grouped nav list
  - Desktop: Full ListSubheader with AccessTime icon + "最近使った" text
  - Mini mode: Tooltip-only (ListSubheader hidden when `navCollapsed`)
  - Mobile: Same layout without collapse logic

- **Visual Separator**:
  - Divider after Recent section for clear separation

## 🎯 User Experience

- **Quick Access**: Users can quickly return to their most frequently accessed pages
- **Smart Filtering**: Recent items automatically hide unavailable items (admin-only, feature-flag, etc.)
- **Persistent**: Survives page reloads and browser sessions
- **Non-intrusive**: Only appears when search is empty, doesn't interfere with search results

## 🎨 Technical Highlights

- **Stable Keys**: Uses `testId` (when available) for robust resolution across nav structure changes
- **Error-Safe**: All localStorage operations wrapped in try/catch with fallbacks
- **Display-Time Resolution**: Recent keys resolved from `filteredNavItems` at render time
- **Type-Safe**: Full TypeScript type guards for localStorage parsing
- **Max 5 Items**: Automatically removes oldest item when 6th is added
- **Deduplication**: Moving existing item to front (no duplicates)

## ✅ Testing

- ✅ Lint: No warnings
- ✅ Typecheck: No errors
- Manual Testing:
  - [ ] Recent section appears after first navigation
  - [ ] Items move to front on re-navigation
  - [ ] 6th item removes last item
  - [ ] Search hides Recent section
  - [ ] Mini mode shows tooltip-only
  - [ ] Admin-only items auto-filter for non-admin users
  - [ ] Survives page reload

## 🔗 Related PRs

- PR #226: Drawer navigation with search & grouping
- PR #227: Keyboard controls (Esc/Enter)
- PR #228: Mini drawer variant

## 📸 Preview (ASCII Mockup)

**Desktop (Normal)**:
```
🔍 [search box]
⬅️ [collapse toggle]
───────────────
🕐 最近使った
  📊 Dashboard
  👥 利用者一覧
  📝 記録入力
───────────────
📒 黒板記録
  ...
```

**Desktop (Mini)**:
```
🔍
⬅️
───
🕐 (tooltip only)
  📊 (tooltip only)
  👥 (tooltip only)
───
📒 (tooltip only)
  ...
```

**During Search**:
```
🔍 [dashboard]
⬅️
(Recent hidden)
───────────────
📒 黒板記録
  ❌ Dashboard  ← filtered result
```

---

**Merge Confidence**: ✅ Ready for merge after checklist completion
