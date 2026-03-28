# Contrast Backlog (`/admin/exception-center`)

- Date: 2026-03-28
- Scope: `#app-main-content` only
- Rules:
  - `color-contrast`
  - smoke gate companion rules: `aria-roles`, `button-name`
- Modes: `light` / `dark`

## Baseline

- `light`
  - `color-contrast`: 1 violation / 3 nodes
  - `button-name`: 1 violation / 1 node
- `dark`
  - `color-contrast`: 1 violation / 6 nodes
  - `button-name`: 1 violation / 1 node

## Latest Rescan

- after `C-EXC-01`/`C-EXC-02`/`C-EXC-03`
  - `light`: `color-contrast = 0`, smoke rules = 0
  - `dark`: `color-contrast = 0`, smoke rules = 0

## Backlog Table

| ID | Screen | Mode | System | Axe target | Likely source | Suggested fix (smallest unit) | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-EXC-01 | `/admin/exception-center` | dark | Table header | `.MuiTableCell-root` (header row 6 nodes) | `src/features/exceptions/components/ExceptionTableRows.tsx` | Header background `grey.50` を `action.hover` に変更し、header text color を `text.primary` 明示 | P0 | Done |
| C-EXC-02 | `/admin/exception-center` | light | Top control/button | `.MuiButton-sizeMedium` (`exception-center-back`) | `src/pages/admin/ExceptionCenterPage.tsx` | 戻るボタン文字色を `text.primary` に明示 | P1 | Done |
| C-EXC-03 | `/admin/exception-center` | light/dark | Icon button name | `.MuiIconButton-root` | `src/features/exceptions/components/ExceptionTableControls.tsx`, `src/features/exceptions/components/ExceptionTableRows.tsx` | icon-only `IconButton` に `aria-label` 付与 | P0 | Done |

## Gate Status

- Added: `tests/e2e/exception-center.a11y-smoke.spec.ts`
  - modes: `light` / `dark`
  - rules: `aria-roles`, `button-name`, `color-contrast`
- Added: `tests/e2e/exception-center.usability.spec.ts`
  - keyboard: skip link から table control へ到達できることを検証
  - mobile: table 横スクロールが container 内で完結し、ページ全体が横スクロールしないことを検証
