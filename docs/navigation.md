# ナビゲーション変更手順

サイドバーにルートやメニューを追加・変更するときの手順です。

## 新しいルートを追加する

1. **ルーター登録**: `src/app/router.tsx` に `{ path: '...', element: <Page /> }` を追加
2. **ナビ登録**: `src/app/config/navigationConfig.ts` の `createNavItems()` にエントリ追加
   - `group`: 必須（`daily` / `record` / `review` / `master` / `admin` / `settings`）
   - `audience`: `all` / `staff` / `admin` / `reception`
   - feature flag がある場合は `CreateNavItemsConfig` にフラグを追加し、`if (flagEnabled)` で囲む
3. **testid 追加**: `src/testids.ts` の `NAV_TESTIDS` にエントリ追加

## feature flag を追加する

1. `src/lib/env.ts` に `is*Enabled()` 関数を追加
2. `src/config/featureFlags.ts` の `FeatureFlagSnapshot` と `resolveFeatureFlags()` にキーを追加
3. `tests/unit/env-featureFlags-sync.spec.ts` の `FLAG_RESOLVER_MAP` と `NAV_CONFIG_TO_SNAPSHOT` を更新

## チェックリスト

- [ ] `group` を明示指定した（DEV 警告が出ないことを確認）
- [ ] `audience` を適切に設定した
- [ ] E2E テスト通過（`npx playwright test tests/e2e/app-shell.*.spec.ts tests/e2e/nav.smoke.spec.ts`）
- [ ] Unit テスト通過（`npx vitest run tests/unit/env-featureFlags-sync.spec.ts tests/unit/app/config/navigationConfig.spec.ts`）
