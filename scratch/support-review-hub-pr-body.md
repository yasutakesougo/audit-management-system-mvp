# feat(nav): add support review hub for assessment analysis and planning

## Summary
Simplifies the sidebar navigation by collapsing three highly-technical, abstract screens under the `'severe'` group into a single, user-friendly entry point labeled **「支援の確認・見直し」** routing to a brand new **Support Review Hub** (`/support-review`).

This change drastically reduces cognitive load for care workers, presenting them with concrete, goal-oriented pathways rather than abstract system names, while preserving 100% of the underlying page logic, direct URL routes, and existing feature integrations.

> [!IMPORTANT]
> This PR does not merge the assessment, analysis, and planning features.
> It only simplifies the navigation entry point and introduces a hub-and-spoke screen to reduce cognitive load for field staff.

---

## Detailed Changes

### 1. Unified Side Navigation Entrance
- **Sidebar Label Update**: Renamed navigation group `'severe'` (previously "🔍 分析して改善") to **「🔍 支援を見直す」** to align with the action of care quality reviews.
- **Collapsing Sidebar Items**: Consolidated the three legacy items (支援計画シート, アセスメント, 分析ワークスペース) into a single unified item: **「支援の確認・見直し」** (`/support-review`), targeting the new Hub.
- **Source Preservation**: Direct URLs to the existing paths (`/planning-sheet-list`, `/assessment`, `/analysis`) remain fully active to guarantee that deep links, page-to-page bridges, and automatic triggers function perfectly.

### 2. Premium Support Review Hub Page (`/support-review`)
Renders a responsive, high-fidelity grid of 4 goal-oriented action cards utilizing curated themed palettes, elevation cards, and hover micro-animations matching the codebase design language:
1. **現在の支援計画を見る**: Links to `/planning-sheet-list` (いま有効な計画と見直しの進捗を確認).
2. **本人の特性を確認する**: Links to `/assessment` (強み・困りごと・感覚特性の整理).
3. **困りごとの背景を整理する**: Links to `/analysis` (氷山モデルを用いた環境要因・背景仮説の分析).
4. **支援計画に反映する**: Links to `/support-planning-sheet/new` (分析結果やモニタリングを取り込んだ新期計画作成).

### 3. Navigation Infrastructure & Testing
- **Test ID Registry**: Appended the canonical `TESTIDS.nav.supportReviewHub` (`nav-support-review-hub`) in `src/testids.ts`.
- **Router Configuration**: Registered route `/support-review` mapping to `<SuspendedSupportReviewHubPage />` inside `analysisRoutes.tsx` with standard viewer-role verification.
- **Lazy Loading**: Added code-splitting for `SupportReviewHubPage` inside `lazyPages.tsx` to optimize build sizes.
- **Unit Tests Updated**: Added a unit test assertion in `navigationConfig.test.ts` to enforce that the unified item correctly registers in the `'severe'` navigation group.

---

## Verification Results

### Vitest Suite (18/18 Passed)
All navigation configuration and Shell-routing unit tests are fully verified and pass successfully:
```bash
npx vitest run src/app/config/__tests__ src/app/__tests__/AppShell.navigation.spec.tsx
```
Output:
```text
✓ src/app/config/__tests__/navigationConfig.helpers.spec.ts (5 tests)
✓ src/app/config/__tests__/navigationConfig.contract.spec.ts (3 tests)
✓ src/app/config/__tests__/navigationConfig.test.ts (6 tests)
✓ src/app/__tests__/AppShell.navigation.spec.tsx (4 tests)

Test Files  4 passed (4)
     Tests  18 passed (18)
```
