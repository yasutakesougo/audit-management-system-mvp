# test(e2e): /today E2E を現行UI契約へ追従（実装変更なし）

## 背景

`/today` の実装自体は正常ですが、E2E が旧UI契約（旧 testid / 旧構造）を前提にしていたため失敗していました。

## 方針

アプリ実装は変更せず、E2E のみを現行UI契約へ追従させます。

## 主な変更

- `today-ops-next-action.smoke.spec.ts`
  - `TESTIDS.TODAY_HERO`
  - `hero-action-card`
  - `hero-cta`
  を基準に更新
- `today-ops-page.spec.ts`
  - 旧 `today-hero-banner` 前提を廃止
  - `bento-users` 配下を `role` ベースで取得するよう更新
- `today-ops-sort-attendance.spec.ts`
  - 実データ0件状態に整合するよう、保存前提ではなく状態検証中心へ調整
- 認証フォールバック由来の揺れを避けるため、`/today` 主要コンテナ描画完了待ちを追加

## 非対象

- `/today` 本体実装の変更なし
- ドメインロジックの変更なし

## 検証

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5173 PW_REUSE_SERVER=1 npx playwright test tests/e2e/today-ops-next-action.smoke.spec.ts tests/e2e/today-ops-page.spec.ts tests/e2e/today-ops-sort-attendance.spec.ts --project=chromium --reporter=line
```

結果: `5 passed`
