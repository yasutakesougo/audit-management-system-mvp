# Contrast Backlog (`/today`, `/schedules/week`)

- Date: 2026-03-28
- Scope: `#app-main-content` only
- Rule: axe `color-contrast`
- Modes: `light` / `dark`
- Baseline status:
  - `/today`: `light` pass (after `C-TODAY-01`), `dark` fail
  - `/schedules/week`: `light` pass, `dark` fail
- Latest rescan:
  - after `C-TODAY-01`: `/today` `light` = 0, `/today` `dark` = 11 nodes
  - after `C-TODAY-02`: `/today` `dark` = 9 nodes (section overline resolved)
  - after `C-TODAY-03/04`: `/today` `light` = 0, `/today` `dark` = 0 (`ProgressRings` labels/value/status resolved)
  - after `C-SCH-01`: `/schedules/week` `dark` = 7 nodes (weekday header text only)
  - after `C-SCH-05`: `/schedules/week` `dark` = 0 nodes (`color-contrast` resolved)

## Summary

| Screen | Light | Dark | Main affected systems |
| --- | --- | --- | --- |
| `/today` | 0 | 0 (after `C-TODAY-03/04`) | resolved |
| `/schedules/week` | 0 | 15 violation nodes (baseline) | tabs, helper text, header controls, table header |
| `/schedules/week` | 0 | 7 violation nodes (after `C-SCH-01`) | table header |
| `/schedules/week` | 0 | 0 (after `C-SCH-05`) | resolved |

## Backlog Table

| ID | Screen | Mode | System | Axe target | Likely source | Suggested fix (smallest unit) | Priority | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| C-TODAY-01 | `/today` | light | Button | `.MuiButton-outlinedSuccess` (`hero-cta`) | [HeroActionCard.tsx](/Users/yasutakesougo/audit-management-system-mvp/src/features/today/components/HeroActionCard.tsx) | `outlined + success` の文字/枠色を light 時のみ `success.dark` 側へ寄せて AA を確保 | P1 | Done |
| C-TODAY-02 | `/today` | dark | Helper text | `.MuiTypography-overline` (`📊 本日の進捗`) | [TodayBentoLayout.tsx](/Users/yasutakesougo/audit-management-system-mvp/src/features/today/layouts/TodayBentoLayout.tsx) | `SectionLabel` を dark 時のみ `grey[700]` に寄せ、明背景カード上の overline コントラストを確保 | P1 | Done |
| C-TODAY-03 | `/today` | dark | Badge/Ring labels | `div[data-testid="progress-ring-*"] .MuiTypography-caption` | [ProgressRings.tsx](/Users/yasutakesougo/audit-management-system-mvp/src/features/today/components/ProgressRings.tsx) | ring label/status の caption 色を dark 時のみ高コントラスト色へ調整 | P1 | Done |
| C-TODAY-04 | `/today` | dark | Badge/Ring value | `.MuiTypography-body1` (`0件`), `.MuiTypography-caption` (`完了`) | [ProgressRings.tsx](/Users/yasutakesougo/audit-management-system-mvp/src/features/today/components/ProgressRings.tsx) | `CountBadge` の値文字色を dark 時のみ高コントラスト色へ調整 | P1 | Done |
| C-TODAY-05 | `/today` | dark | Helper text | `bento-users` 内 `あと1名で完了` | [UserCompactList.tsx](/Users/yasutakesougo/audit-management-system-mvp/src/features/today/widgets/UserCompactList.tsx) | `text.secondary` のまま不足する場合は dark 時のみ `text.primary` へ寄せる | P2 | Not reproduced in current smoke dataset |
| C-SCH-01 | `/schedules/week` | dark | Heading | `#schedules-week-heading` (`予定表`) | [WeekPage.tsx](/Users/yasutakesougo/audit-management-system-mvp/src/features/schedules/routes/WeekPage.tsx) | sticky header 背景を dark 対応（固定 `rgba(255,255,255,0.96)` を mode 分岐） | P0 | Done |
| C-SCH-02 | `/schedules/week` | dark | Tabs | `button[data-testid="schedule-tab-ops"]`, `schedule-tab-list` | [SchedulesHeader.tsx](/Users/yasutakesougo/audit-management-system-mvp/src/features/schedules/components/SchedulesHeader.tsx) | 未選択タブ文字色を dark 背景/明背景の双方で AA を満たす token に調整 | P1 | Done (resolved via C-SCH-01) |
| C-SCH-03 | `/schedules/week` | dark | Helper text | `#schedules-week-range` (`表示期間`) | [SchedulesHeader.tsx](/Users/yasutakesougo/audit-management-system-mvp/src/features/schedules/components/SchedulesHeader.tsx) | range label の `text.secondary` を dark sticky 背景に合わせて調整 | P1 | Done (resolved via C-SCH-01) |
| C-SCH-04 | `/schedules/week` | dark | Header controls | `今日`, `前`, `次`, `絞り込み` ボタン | [SchedulesHeader.tsx](/Users/yasutakesougo/audit-management-system-mvp/src/features/schedules/components/SchedulesHeader.tsx) | text/outlined ボタンの色を dark sticky 背景で AA 達成する値に統一 | P1 | Done (resolved via C-SCH-01) |
| C-SCH-05 | `/schedules/week` | dark | Table header | `.w-full > div:nth-child(2..8) > div` (曜日ヘッダ) | [WeekTimeGrid.tsx](/Users/yasutakesougo/audit-management-system-mvp/src/features/schedules/routes/WeekTimeGrid.tsx) | ヘッダ文字色を明示して dark 継承色による低コントラストを回避 | P1 | Done |

## Fix Order (recommended)

1. Monitor: C-TODAY-05 on production-like data if `bento-users` helper text appears

## Notes

- Current gates:
  - `/today` smoke gate: `aria-roles`, `button-name`, `color-contrast`
  - `/schedules/week` smoke gate: `aria-roles`, `button-name`, `color-contrast`
- `color-contrast` re-enabled in:
  - [today.a11y-smoke.spec.ts](/Users/yasutakesougo/audit-management-system-mvp/tests/e2e/today.a11y-smoke.spec.ts)
  - [schedules.a11y-smoke.spec.ts](/Users/yasutakesougo/audit-management-system-mvp/tests/e2e/schedules.a11y-smoke.spec.ts)
