# kiosk-release 追加実装 Runbook

## 目的
- `deploy-cloudflare-worker` に `release_scope` を追加し、`full` と `kiosk` を分離。
- 既存 `full` 経路は現状維持。
- `kiosk` 経路は `test:ci:kiosk-release` + 追加した契約付き E2E で検証。

## 実行フロー
1. `release_scope` を指定して workflow_dispatch を起動（既定 `full`）。
2. `expected_sha` が最新 main SHA と一致することを `Check expected SHA` で検証。
3. `CONFIRM_PRODUCTION_DEPLOY`（`CONFIRM_PRODUCTION_DEPLOY`）入力を確認。
   - `full` は `DEPLOY`
   - `kiosk` は `DEPLOY_KIOSK`
4. `npm run lint`, `npm run typecheck`, `npm run build` を実行。
5. `RELEASE_SCOPE` に応じて回帰テストを切替。
6. `bundle:check` と `bundle:assert` を実行。
7. Dry-run デプロイ後、production deploy と Cloudflare 設定。

## `release_scope` 別の必要条件
- `full`: `npm run test:ci:required`
- `kiosk`: `npm run test:ci:kiosk-release`
  - 先頭で`node --test scripts/ci/__tests__/deploy-cloudflare-worker-workflow-contract.spec.mjs`を実行
  - `tests/unit/runtimeEnvOverrides.spec.ts`
  - `tests/unit/env.runtime.spec.ts`
  - `src/app/AppShell.kiosk-route.spec.tsx`
  - `src/app/__tests__/AppShell.kiosk-nav.spec.tsx`
  - `src/lib/data/__tests__/createDataProvider.spec.ts`
  - `src/lib/__tests__/dataProviderObservabilityStore.spec.ts`
  - `src/features/kiosk/domain/__tests__/kioskProcedureMemo.spec.ts`
  - `src/features/daily/repositories/sharepoint/__tests__/executionRepositoryFactory.spec.ts`
  - `tests/e2e/kiosk-user-selection.spec.ts`
  - `tests/e2e/kiosk-procedure-list.spec.ts`
  - `tests/e2e/kiosk-procedure-detail.spec.ts`
  - `tests/e2e/kiosk-toilet.spec.ts`

### トイレE2Eの保存区分
- `kiosk-toilet.spec.ts`はmemory/localStorage providerで実行する。
- SharePoint stubを経由する場合も、実SharePointまたは本番Workersへの保存証明として扱わない。
- 保存後の`page.reload()`で記録表示と`RecordDate`が`2026-05-08`のまま再読込されることを確認する。

## 追加E2E契約
- console error 0
- page error 0
- request failure 0（明示 allowlist あり）
- runtime env `VITE_SKIP_LOGIN=1`
- runtime env `VITE_E2E=1`
- localStorage `skipLogin=1`
- キオスクルート検知（`/kiosk` または `?kiosk=` または AppShell の `data-kiosk="true"`）
- data-provider 属性の確認

## 未証明項目
- タッチ端末専用の`hasTouch`挙動は未証明。
- タッチスクロール専用のregressionは未証明。

## 補足
- 本提案は production 環境への実デプロイ/分岐済み rollback 手順の変更は含まず。
- 本runbookのkiosk E2Eはmemory/localStorageまたはSharePoint stubの検証であり、production保存証明ではない。
- branch protection 変更は実施しない。
- `production` 環境の `secrets`/`approvals` は別途設定が必要。
