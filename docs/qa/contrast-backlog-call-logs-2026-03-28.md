# Contrast Backlog (`/call-logs`)

- Date: 2026-03-28
- Scope: `#app-main-content`
- Rules:
  - `color-contrast`
  - smoke companion rules: `aria-roles`, `button-name`
- Modes: `light` / `dark`
- Scan state:
  - baseline is taken on empty-state rendering (`call-log-empty`) and populated rendering (`call-log-list`) with `VITE_SKIP_SHAREPOINT=1`

## Baseline

- `light / empty`
  - `color-contrast`: 1 violation / 2 nodes
    - page header subtitle (`— 受電・伝言の受付と対応管理`)
    - selected tab (`#call-log-tab-new`)
  - smoke rules: 0
- `light / populated`
  - `color-contrast`: 1 violation / 3 nodes
    - status chip (`MuiChip-colorWarning` outlined label)
    - urgency chip (`call-log-urgency-chip-today` outlined label)
    - hero CTA (`MuiButton-containedSuccess`)
  - smoke rules: 0
- `dark`
  - `color-contrast`: 0
  - smoke rules: 0

## Latest Rescan

- after `C-CALLLOG-01`/`C-CALLLOG-02`/`C-CALLLOG-03`/`C-CALLLOG-04`/`C-CALLLOG-05`
  - `light`: `color-contrast = 0`, smoke rules = 0
  - `dark`: `color-contrast = 0`, smoke rules = 0

## Backlog Table

| ID | Screen | Mode | System | Axe target | Likely source | Suggested fix (smallest unit) | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-CALLLOG-01 | `/call-logs` | light | Header helper text | PageHeader subtitle caption | `src/components/PageHeader.tsx`, `src/pages/CallLogPage.tsx` | `PageHeader` に `subtitleColor` props を追加し、CallLog の subtitle を `text.secondary` に上げる | P1 | Done |
| C-CALLLOG-02 | `/call-logs` | light | Tabs | `#call-log-tab-new` | `src/pages/CallLogPage.tsx` | tabs の selected/unselected 文字色を明示 (`text.primary` / `text.secondary`) | P1 | Done |
| C-CALLLOG-03 | `/call-logs` | dark | Empty-state hero heading | `h6` (`next-call-hero-clear`) | `src/features/callLogs/components/NextCallHero.tsx` | clear-state card の `success` 配色を mode-aware に調整し、dark で見出し/補助文言のコントラストを確保 | P1 | Done |
| C-CALLLOG-04 | `/call-logs` | light | Chips (status/urgency) | warning outlined chip label / `call-log-urgency-chip-today` | `src/features/callLogs/components/CallLogStatusChip.tsx`, `src/features/callLogs/components/CallLogUrgencyChip.tsx` | 視認性の低い outlined を filled へ切替（`new`,`callback_pending`,`today`） | P1 | Done |
| C-CALLLOG-05 | `/call-logs` | light | Hero CTA | `.MuiButton-containedSuccess` | `src/features/callLogs/components/NextCallHero.tsx` | Hero の success ボタン背景を mode-aware 化し、light で `success.dark` を使用 | P1 | Done |

## Gate Status

- Added: `tests/e2e/call-logs.a11y-smoke.spec.ts`
  - modes: `light` / `dark`
  - states: `empty` / `populated`
  - rules: `aria-roles`, `button-name`, `color-contrast`
- Added: `tests/e2e/call-logs.usability.spec.ts`
  - modes/states: `light` / `dark` × `empty` / `populated`
  - keyboard: skip link から main へ移動後、call-log controls へ Tab 到達できることを検証
  - mobile: filter bar が縦積みで、ページ全体の横スクロールが発生しないことを検証
