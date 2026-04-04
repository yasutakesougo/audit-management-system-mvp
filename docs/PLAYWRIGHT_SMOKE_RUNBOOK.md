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
- **Hermetic Mode**: `VITE_DATA_PROVIDER: 'memory'` が強制され、本番 SharePoint への通信が遮断される。
- readiness wait（baseURL 疎通）を経て、 smoke suite が実行される。

---

## データ・アイソレーション戦略（重要）

2026-04-03 以降、Smoke テストは **完全密閉型（Hermetic）** をデフォルトとしています。

### なぜ密閉型か
- **環境ノイズの排除**: SharePoint の 404/403 や、他ユーザーによるデータ変更でテストが落ちるのを防ぐ。
- **爆速実行**: API 通信がメモリ内で完結するため、ネットワーク遅延がない。

### テストデータの準備 (InMemoryDataProvider)
テストに必要なデータは、`src/lib/data/inMemoryDataProvider.ts` の `constructor` でシード（Seed）します。

```ts
// 例: staff-attendance テスト用のデータ
this.storage.set('Staff_Master', [
  { Id: 1, StaffID: 'STF001', FullName: 'Staff One', Role: 'reception', IsActive: true },
]);
```

### 統合テスト（Integration）との使い分け
- **Smoke**: `memory` プロバイダー使用。UI 仕様とコードの整合性を担保。
- **Integration**: リアル SharePoint 使用。認証・REST API 契約・Digest 権限を担保。
  - 実行: `npx playwright test --config=playwright.config.ts` (デフォルト)

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

## AppShell role-sync infinite loop guard (2026-01-28)

### Symptom
- Dev/Smokeで `Warning: Maximum update depth exceeded` が発生し、AppShell が再レンダーを繰り返す。

### Root cause
- `setCurrentUserRole` を direct import で参照しており、参照が安定しないケースで
  role-sync effect が再実行 → setState → 再レンダー… のループになり得た。

### Fix (required pattern)
- setter は **必ず Zustand selector で取得**する。

```ts
const currentRole = useAuthStore((s) => s.currentUserRole);
const setCurrentUserRole = useAuthStore((s) => s.setCurrentUserRole);
```

- effect は 入力だけを deps に置き、同値ガードする。

```ts
useEffect(() => {
  const nextRole = location.pathname.startsWith('/admin/dashboard')
    ? 'admin'
    : (location.pathname === '/' || location.pathname.startsWith('/dashboard'))
      ? 'staff'
      : null;

  // nextRole null のときは role を維持
  if (nextRole && nextRole !== currentRole) setCurrentUserRole(nextRole);
}, [location.pathname, currentRole, setCurrentUserRole]);
```

### Defense layers
1. **AppShell effect**: `nextRole && nextRole !== currentRole`
2. **auth store**: 同値なら no-op（`state.currentUserRole === role` → `return`）
3. **selector 取得**: setter 参照を安定化

### Regression tests
- **Unit**: [src/app/AppShell.role-sync.spec.tsx](../src/app/AppShell.role-sync.spec.tsx)
- **E2E smoke**: [tests/e2e/schedule-week.smoke.spec.ts](../tests/e2e/schedule-week.smoke.spec.ts)
  - `"Maximum update depth exceeded"` / `"Too many re-renders"` を console/pageerror から検知して fail する
  - role path を跨ぐ遷移（admin ↔ staff ↔ week）でもループしないことを確認

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

#### 🔴 最優先（まずこれを見る）

- **failure.pageerror.log**  
  → ブラウザで発生した JavaScript エラー（原因の当たりが一番つく）
- **failure.request.log**  
  → `requestfailed` のリングバッファ（max 50）。method / url / status / resourceType / failureText を記録
- **failure.console.log**  
  → ブラウザコンソール出力（リングバッファ max 100 件）

#### 📊 補助情報

- **failure.png**  
  → フルページスクリーンショット（UI 状態確認）
- **failure.url.txt**  
  → 失敗時の URL（想定ルートか確認）
- **failure.html**  
  → DOM スナップショット（要素未描画・条件分岐確認）


### 4. 即時原因の判定フロー（error / request / console）

**pageerror.log に内容がある場合:**
- JavaScript エラーが最大の犯人
  - `Cannot read property ...` → selector/locator ズレ
  - `fetch failed` → API 通信エラー
  - `MUI portal error` → component lifecycle 問題

**request.log に内容がある場合:**
- `403` / `blocked` → 権限 / CSP / トークン
- `timeout` → wait 不足 / 並列実行 / 環境差
- `net::ERR_*` → ネットワーク / Proxy / DNS
- resourceType の目安: xhr/fetch=API、script=CSP/デプロイ差分、document=認証/リダイレクト

**console.log に WARNING/ERROR がある場合:**
- React warning → prop/hook/dependency 問題
- Network error → API/timeout 問題
- Feature flag → VITE_FEATURE_* チェック

**pageerror/console/request が空の場合:**
- MUI popup / tab / portal 未描画（role 判定がズレた）
- 非同期待ち不足（timeout が足りない）
- → 次に `failure.png` / `failure.html` を確認


### 実装例（段階的進化）

**PR #205** - Screenshot / URL / DOM 自動添付
- [diagArtifacts.ts](../tests/e2e/_helpers/diagArtifacts.ts) v1

**PR #207** - Console / PageError ログ自動添付 ✨
- [diagArtifacts.ts](../tests/e2e/_helpers/diagArtifacts.ts) v2 (ConsoleLogger / PageErrorCollector)
- リングバッファ: max 100 console messages
- PageError: すべての page.on('pageerror') イベント

**PR #209** - Request failed ログ自動添付 ✨
- [diagArtifacts.ts](../tests/e2e/_helpers/diagArtifacts.ts) v3 (RequestLogger)
- リングバッファ: max 50 requestfailed
- 記録: method / url / status / resourceType / failureText

**適用 spec:**
- [monthly.summary-smoke.spec.ts](../tests/e2e/monthly.summary-smoke.spec.ts)
- [diagnostics-health-save.smoke.spec.ts](../tests/e2e/diagnostics-health-save.smoke.spec.ts)

**原則：再実行する前に artifacts を読む**

---

## MUI Select / Menu の勝ちパターン（CI安定版「monthly型」）

**目的**：MUI Select / Menu / Portal を使用するテストで「CI Only Failure」や「listbox timeout」を撲滅する。

**概要**：
- `tests/e2e/utils/muiSelect.ts` に共通パターンを実装
- コピペ + 最小調整で横展開可能な「型」として設計

### 必須 4点セット

#### 1. Dual-role locator

```typescript
const popup = page.locator('[role="listbox"], [role="menu"]');
```

**理由**：MUI は Select / Menu / Autocomplete で異なる role を使う。両者に対応。

#### 2. Staged wait（attached → visible）

```typescript
await expect(popup).toBeAttached({ timeout: 15_000 });
await expect(popup).toBeVisible({ timeout: 15_000 });
```

**理由**：CI で「DOM はあるが表示遅い」を吸収（Portal rendering の遅延対応）。

#### 3. Keyboard fallback（ArrowDown try/catch）

```typescript
await trigger.click();
await trigger.press('ArrowDown').catch(() => {
  // Portal / focus 問題を回避
});
```

**理由**：focus 管理が不確定な場合、ArrowDown で確実に popup を進める。

#### 4. Non-fatal skip（選択肢 0件でも test を fail させない）

```typescript
if (await options.count() === 0) {
  console.warn('[mytest] no options; skipping');
  return false; // 環境差を吸収
}
```

**理由**：モックデータ依存で「選択肢 0件」になることがある。non-fatal skip で許容。

### 使用方法

#### A. 最初の option を選択する（最シンプル）

```typescript
import { selectFirstMuiOption } from './utils/muiSelect';

const monthSelect = page.getByTestId('month-select');
const selected = await selectFirstMuiOption(page, monthSelect);

if (!selected) {
  console.warn('[mytest] no options; skipping');
}
```

#### B. ラベル条件で option を選択する（正規表現対応）

```typescript
import { selectMuiOptionByLabel } from './utils/muiSelect';

const rateFilter = page.getByTestId('rate-filter');
const selected = await selectMuiOptionByLabel(
  page,
  rateFilter,
  /80%以上|90%以上/
);

if (!selected) {
  console.warn('[mytest] matching option not found; skipping');
}
```

#### C. 低レベル API（popup を自分で操作したい場合）

```typescript
import { openMuiSelect } from './utils/muiSelect';

const trigger = page.getByTestId('custom-select');
const popup = await openMuiSelect(page, trigger);

const options = popup.locator('[role="option"]');
// ここから自由に操作
await options.nth(2).click();
```

### 適用済みの spec

- [monthly.summary-smoke.spec.ts](../tests/e2e/monthly.summary-smoke.spec.ts) ✅
  - `month filter functionality` (line 78)
  - `completion rate filter` (line 93)

### 横展開対象（優先度順）

**優先度 S（ほぼ同型）**：
- MUI Select / Menu を直接使用
- portal / popover あり
- 例：billing summary filter、schedule org filter など

**優先度 A（軽調整）**：
- Autocomplete 系（listbox + 入力フィルター）
- ContextMenu 系（menu item のみ）

### 成功指標

✅ "listbox timeout" / "menu timeout" が出なくなる  
✅ CI only failure が消える  
✅ 「あ、monthly型ね」でレビューが終わる  
✅ rerun 文化が不要になる  

---

## テストの安定性を高める

**CI で flaky なテストが増えてきたら：**

👉 **[E2E_BEST_PRACTICES.md](./E2E_BEST_PRACTICES.md)** を参照

Two-layer wait strategy、responsive UI handling、troubleshooting checklist が記載されています。

---

## Barrel Import ガードレール（E2E spec 限定）

> **追加日**: 2026-03-22 — PR #1208 で修正済み

### ルール

**E2E spec (`tests/e2e/**/*.spec.ts`) では barrel import を避け、直接サブモジュールからインポートする。**

```typescript
// ❌ NG — barrel 経由（CJS/ESM crash のリスクあり）
import { SCHEDULE_FIELD_CATEGORY } from '@/sharepoint/fields';

// ✅ OK — 直接サブモジュール
import { SCHEDULE_FIELD_CATEGORY } from '@/sharepoint/fields/scheduleFields';
```

### 理由

- Playwright の ESM runner は Vite と異なり **CJS↔ESM 自動変換を行わない**
- barrel (`index.ts`) の re-export チェーンに CJS パターン (`exports`) が含まれると、
  `ReferenceError: exports is not defined in ES module scope` で **テスト 0 件実行** のまま crash する
- Vite の dev/build では問題にならないため、ローカルでは気づけない

### 該当する barrel（既知）

| barrel | サブモジュール数 | リスク |
|--------|:------------:|:-----:|
| `@/sharepoint/fields` | 40+ modules | 🔴 高 |

### 検知方法

```bash
# E2E spec が barrel import を使っていないか確認
grep -r "from '@/sharepoint/fields'" tests/e2e/ --include="*.ts"
```

---

## 参考資料

- [playwright.smoke.config.ts](../playwright.smoke.config.ts) - webServer 設定の詳細
- [playwright.config.ts](../playwright.config.ts) - ベース設定（デバイス、タイムアウト等）
- [tests/e2e/utils/muiSelect.ts](../tests/e2e/utils/muiSelect.ts) - 「monthly型」実装
- [E2E_BEST_PRACTICES.md](./E2E_BEST_PRACTICES.md) - Element wait 戦略・responsive 対応
- 👉 **[PR_MERGE_CHECKLIST.md](./PR_MERGE_CHECKLIST.md)** — PR 作成〜マージ時の事故防止チェックリスト

