# E2E Strategy (Smoke / Deep)

このリポジトリでは Playwright E2E を **Smoke** と **Deep** に分離して運用します。

## Goals

- **Smoke**: PR 必須（短い・安定・主要導線）
- **Deep**: 非ブロッキング（夜間 or 手動 / `run-ci` ラベル時のみ）
- **Artifacts**: 失敗時のみアップロード（容量節約）

## Smoke

- 実行: PR で常時実行
- 対象: 主要導線のみ（最小セット）
- 設定: [playwright.smoke.config.ts](../playwright.smoke.config.ts)
- Workflow: [.github/workflows/smoke.yml](../.github/workflows/smoke.yml)

## Deep

- 実行: schedule / workflow_dispatch / `run-ci` ラベル
- 対象: Smoke 以外の E2E 全体
- 設定: [playwright.deep.config.ts](../playwright.deep.config.ts)
- Workflow: [.github/workflows/e2e-deep.yml](../.github/workflows/e2e-deep.yml)

## Run-CI Gating

- `run-ci` ラベルが付与された PR で **Deep** が起動
- Draft PR では起動しません

## Smoke 対象（最小セット）

- `tests/e2e/app-shell.smoke.spec.ts`
- `tests/e2e/router.smoke.spec.ts`
- `tests/e2e/nav.smoke.spec.ts`
- `tests/e2e/users-crud.smoke.spec.ts`
- `tests/e2e/schedule-day.aria.smoke.spec.ts`

## Notes

- Deep から Smoke を除外するため `testIgnore: /.*smoke.*\.spec\.ts$/i` を使用
- Smoke の内容は安定性優先で最小セットに保つ