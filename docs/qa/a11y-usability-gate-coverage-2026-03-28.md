# A11y/Usability Gate Coverage (2026-03-28)

## Summary

主要5画面（Users / Today / Schedules / ExceptionCenter / CallLogs）に対して、a11y/usability 改善と回帰 gate の導入を完了。

```md
Users・Today・Schedules・ExceptionCenter・CallLogs に対して、a11y smoke と keyboard/mobile 回帰 gate の横展開を完了した。主要画面の contrast・button-name・Tab 到達性・モバイル横崩れを継続検証できる運用基盤が整った。
```

追加: Today と ExceptionCenter の連携導線を強化し、Today の `司令塔優先` から
ExceptionCenter へ deep link 遷移（category/userId/source）を可能にした。

## Applied Screens

| Screen | State coverage | A11y gate | Usability gate | Main notes |
| --- | --- | --- | --- | --- |
| `/users` | signed-in / signed-out | `users.color-contrast.spec.ts` | `users.usability.spec.ts` | auth guard + safe tab fallback + mobile table + skip link |
| `/today` | light / dark | `today.a11y-smoke.spec.ts` | (shared layout checks) | contrast backlog 解消済み、smoke で `color-contrast` 復帰。`司令塔優先` から ExceptionCenter deep link 遷移を追加 |
| `/schedules/week` | light / dark | `schedules.a11y-smoke.spec.ts` | (shared layout checks) | contrast backlog 解消済み、smoke で `color-contrast` 復帰 |
| `/admin/exception-center` | light / dark | `exception-center.a11y-smoke.spec.ts` | `exception-center.usability.spec.ts` | skip link / Tab 到達 / mobile table スクロールを固定。query で category/userId 絞り込みを復元 |
| `/call-logs` | light / dark × empty / populated | `call-logs.a11y-smoke.spec.ts` | `call-logs.usability.spec.ts` | shared seed 導線と repository 共有化で状態別検証を固定 |

## Gate Inventory

| Type | Specs |
| --- | --- |
| A11y smoke (`aria-roles`, `button-name`, `color-contrast`) | `tests/e2e/today.a11y-smoke.spec.ts`, `tests/e2e/schedules.a11y-smoke.spec.ts`, `tests/e2e/exception-center.a11y-smoke.spec.ts`, `tests/e2e/call-logs.a11y-smoke.spec.ts` |
| Contrast dedicated | `tests/e2e/users.color-contrast.spec.ts` |
| Usability (skip link / keyboard / mobile) | `tests/e2e/users.usability.spec.ts`, `tests/e2e/exception-center.usability.spec.ts`, `tests/e2e/call-logs.usability.spec.ts` |

## Backlog Docs

- `docs/qa/contrast-backlog-today-schedules-2026-03-28.md`
- `docs/qa/contrast-backlog-exception-center-2026-03-28.md`
- `docs/qa/contrast-backlog-call-logs-2026-03-28.md`

## Not Yet Applied (next candidates)

| Screen | Current status | Suggested next action |
| --- | --- | --- |
| `/daily/activity` | gate 未適用 | a11y smoke baseline → contrast backlog 化 |
| `/handoff-timeline` | gate 未適用 | a11y smoke baseline + keyboard導線確認 |
| `/admin` (hub pages) | gate 未適用 | 主要入口ページから smoke を先行導入 |
| `/staff/attendance` | gate 未適用 | mobile/table 崩れ確認 + smoke 追加 |

## Definition of Done (rollout)

1. `light/dark`（必要なら `empty/populated`）で `a11y smoke` が通る。
2. キーボードで skip link 経由の主要操作到達を固定する。
3. モバイルで横崩れせず、横スクロール責務がコンポーネント内に収まる。
4. backlog（原因・最小修正単位・優先度）を docs に残す。
