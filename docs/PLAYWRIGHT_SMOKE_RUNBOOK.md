# Playwright Smoke テスト実行ガイド

このリポジトリの Smoke テストは `playwright.smoke.config.ts` の `webServer` 設定により、
**dev server 起動 → readiness wait → smoke 実行** を自動で行います。

---

## 通常実行（ローカル / CI デフォルト）

```bash
npx playwright test --config=playwright.smoke.config.ts --reporter=line
```

**期待動作：**
- Vite dev server が起動（既に起動済みなら再利用）
- baseURL に対して疎通が取れてからテスト開始
- smoke suite が実行される

---

## データ必須モード（最小 1 件を強制）

スケジュールの smoke を「データ必須（skip せず assert）」で走らせる場合は、
環境変数 `E2E_REQUIRE_SCHEDULE_DATA=1` を付与してください。

```bash
E2E_REQUIRE_SCHEDULE_DATA=1 npx playwright test --config=playwright.smoke.config.ts --reporter=line
```

このフラグが有効な場合、boot helper はスケジュール一覧が空の環境でも
テスト日に 1 件の最小イベントを自動シードし、week view に 1 件以上が表示されることを保証します。

---

## ポート衝突回避（5173 が使用中の場合）

別プロセスが 5173 を使用している場合：

```bash
E2E_PORT=6173 npx playwright test --config=playwright.smoke.config.ts --reporter=line
```

**メモ：**
- `E2E_PORT` は `webServer.url` と `use.baseURL` の両方に反映される想定
- CI で並列ジョブがある場合にも有効

---

## CONNECTION_REFUSED トラブルシューティング

### まず疑うポイント（最重要）

`playwright.smoke.config.ts` の  
`webServer.url` / `use.baseURL` / Vite 起動時の `--host` / `--port` が  
**完全に一致**しているかを確認します。

- `url` と `baseURL` の host がズレていないか  
  （例：`localhost` vs `127.0.0.1`）
- `--host` が `127.0.0.1` になっているか  
  （DNS / IPv6 由来のズレ回避）
- `E2E_PORT` を使う場合、`url` / `baseURL` が同じ PORT を指しているか

### 30秒チェック（手元で疎通確認）

```bash
# 実際に listen しているか
lsof -nP -iTCP:${E2E_PORT:-5173} -sTCP:LISTEN

# HTTP 疎通が取れるか
curl -s -I http://127.0.0.1:${E2E_PORT:-5173} | head -3
```

### よくある原因

- Vite が `localhost` で listen、Playwright が `127.0.0.1` を見ている（または逆）
- `E2E_PORT` を指定したが、config 側の `url` / `baseURL` が固定のまま
- 別のプロセスが同ポートを使用中（起動失敗 or 別サーバを参照）

### 相談時に貼るもの

- `playwright.smoke.config.ts` の `webServer` と `use.baseURL` 周辺（該当箇所）
- smoke 実行時の先頭 30〜50 行のログ

---

## MUI Tabs 安定化パターン（勝ちパターン）

**背景：** MUI Tabs は roving tabindex + focus 管理を使うため、keyboard navigation (`ArrowRight`/`Left` + `focus()`) は CI で不安定。

**推奨アプローチ：**
- タブ切り替えは **`click()`** を使用（keyboard は避ける）
- `aria-selected` チェックは `.catch(() => {})` でオプション化
- **panel visibility** を strict 指標に採用（例：`detailRecordsTable`, `summaryTable`）

**実装例：** [monthly.summary-smoke.spec.ts](../tests/e2e/monthly.summary-smoke.spec.ts) の tab navigation test 参照

---

## 失敗時アーティファクト回収（Smoke Tests）

CI の smoke tests が失敗した場合、**URL / DOM / Screenshot が自動で添付**されます。
再現環境を作らずに、まず以下を確認してください。

### 1. 失敗した Run を確認

```bash
gh run list --limit 10
gh run view <RUN_ID> --log-failed
```

### 2. 添付アーティファクトを取得

```bash
gh run download <RUN_ID> -D /tmp/gh-artifacts
ls -R /tmp/gh-artifacts
```

### 3. 含まれるファイル

- **failure.png**  
  → フルページスクリーンショット（最優先で確認）
- **failure.url.txt**  
  → 失敗時の URL（想定ルートか確認）
- **failure.html**  
  → DOM スナップショット（要素未描画・条件分岐確認）

### 4. 想定される即時原因

- MUI popup / tab / portal 未描画
- 権限・feature flag 不一致
- 非同期待ち不足（attach はあるが visible でない）

### 実装例

- [tests/e2e/_helpers/diagArtifacts.ts](../tests/e2e/_helpers/diagArtifacts.ts)
- 適用 spec:
  - [monthly.summary-smoke.spec.ts](../tests/e2e/monthly.summary-smoke.spec.ts)
  - [diagnostics-health-save.smoke.spec.ts](../tests/e2e/diagnostics-health-save.smoke.spec.ts)

**原則：再実行する前に artifacts を読む**

---

## 参考資料

- [playwright.smoke.config.ts](../playwright.smoke.config.ts) - webServer 設定の詳細
- [playwright.config.ts](../playwright.config.ts) - ベース設定（デバイス、タイムアウト等）
